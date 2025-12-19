const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const eip712Utils = require('./utils/eip712-utils');
const EventListener = require('./services/event-listener');
const BookingService = require('./services/booking-service');
const CryptoPaymentService = require('./services/crypto-payment-service');
const CustodialSigner = require('./services/custodial-signer');
const PropertySyncService = require('./services/property-sync-service');
const CDPWalletService = require('./services/cdp-wallet-service');
const PayoutService = require('./services/payout-service');
require('dotenv').config();
const axios = require('axios');

// Load deployment info
const fs = require('fs');
const path = require('path');

// Try to load Base Sepolia deployment first, fall back to Viction if not found
let deploymentInfo;
const baseSepoliaPath = path.join(__dirname, '/config/deployment-base-sepolia.json');
const victionPath = path.join(__dirname, '/config/deployment-all-viction-testnet.json');

if (fs.existsSync(baseSepoliaPath)) {
    deploymentInfo = JSON.parse(fs.readFileSync(baseSepoliaPath, 'utf8'));
    console.log('📦 Loaded Base Sepolia deployment configuration');
} else if (fs.existsSync(victionPath)) {
    deploymentInfo = JSON.parse(fs.readFileSync(victionPath, 'utf8'));
    console.log('📦 Loaded Viction Testnet deployment configuration (legacy)');
} else {
    console.error('❌ No deployment configuration found!');
    console.log('   Run deployment script first: npx hardhat run scripts/deployment/deploy-base-sepolia.js --network baseSepolia');
    process.exit(1);
}

class BlockchainService {
    constructor() {
        // Initialize provider - prefer Base Sepolia, fall back to Viction
        const rpcUrl = process.env.BASE_SEPOLIA_RPC || process.env.VICTION_TESTNET_RPC || 'https://sepolia.base.org';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        console.log(`🔗 Connected to RPC: ${rpcUrl}`);
        
        // Initialize relayer (your backend account)
		const pk = process.env.RELAYER_PRIVATE_KEY || '';
		if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
			console.warn('⚠️  RELAYER_PRIVATE_KEY missing or invalid format. Meta-tx execution will be disabled until a valid key is provided.');
			this.relayer = null; // no signer
		} else {
			this.relayer = new ethers.Wallet(pk, this.provider);
		}
        
        // Initialize contracts
        this.initializeContracts();
    }
    
    async initializeContracts() {
        // Load contract ABIs
		const PropertyMarketplaceABI = require('./artifacts/contracts/PropertyMarketplace.sol/PropertyMarketplace.json').abi;
		const BookingManagerABI = require('./artifacts/contracts/BookingManager.sol/BookingManager.json').abi;
		const MetaTransactionForwarderABI = require('./artifacts/contracts/MetaTransactionForwarder.sol/MetaTransactionForwarder.json').abi;

		// Standard ERC-20 ABI for EURC
		const ERC20_ABI = [
			'function approve(address spender, uint256 amount) returns (bool)',
			'function allowance(address owner, address spender) view returns (uint256)',
			'function balanceOf(address account) view returns (uint256)',
			'function decimals() view returns (uint8)',
			'function symbol() view returns (string)',
			'function transfer(address to, uint256 amount) returns (bool)',
		];

		const runner = this.relayer ?? this.provider; // read-only when no signer

        // Initialize contract instances
        this.propertyMarketplace = new ethers.Contract(
            deploymentInfo.contracts.PropertyMarketplace,
            PropertyMarketplaceABI,
			runner
        );

        this.bookingManager = new ethers.Contract(
            deploymentInfo.contracts.BookingManager,
            BookingManagerABI,
			runner
        );

        this.forwarder = new ethers.Contract(
            deploymentInfo.contracts.MetaTransactionForwarder,
            MetaTransactionForwarderABI,
			runner
        );

        // Initialize EURC token contract if address is available
        const eurcAddress = deploymentInfo.contracts?.EURCToken || process.env.EURC_TOKEN_ADDRESS;
        if (eurcAddress) {
            this.eurcToken = new ethers.Contract(eurcAddress, ERC20_ABI, runner);
            console.log('💶 EURC Token:', eurcAddress);
        }

        console.log('✅ Blockchain service initialized');
        console.log('📊 Contract Addresses:', deploymentInfo.contracts);
    }
	
	getChainId() {
		return deploymentInfo.chainId || Number(process.env.CHAIN_ID) || 89;
	}
	
	// Build typed data (domain/types/message) from a base meta-tx
	buildTypedData(metaTxBase) {
		const domain = {
			name: 'PropertyRental',
			version: '1',
			chainId: this.getChainId(),
			verifyingContract: deploymentInfo.contracts.MetaTransactionForwarder
		};
		const types = {
			MetaTransaction: [
				{ name: 'from', type: 'address' },
				{ name: 'to', type: 'address' },
				{ name: 'value', type: 'uint256' },
				{ name: 'data', type: 'bytes' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' }
			]
		};
		const message = {
			from: metaTxBase.from,
			to: metaTxBase.to,
			value: metaTxBase.value,
			data: metaTxBase.data,
			nonce: metaTxBase.nonce,
			deadline: metaTxBase.deadline
		};
		return { domain, types, message };
	}
    
    // Property listing with meta-transaction
	async listProperty(userAddress, userSignature, propertyData, deadlineOverride) {
        try {
			if (!this.relayer) {
				return { success: false, error: 'Relayer not configured' };
			}
			const deadline = Number(deadlineOverride) || (Math.floor(Date.now() / 1000) + 3600); // use provided deadline if available
			const chainId = this.getChainId();

			// Ensure pricePerNight is a bigint in wei
			const normalizedData = {
				uri: propertyData.uri,
				pricePerNight: typeof propertyData.pricePerNight === 'bigint'
					? propertyData.pricePerNight
					: ethers.parseEther(propertyData.pricePerNight.toString()),
				tokenName: propertyData.tokenName,
				tokenSymbol: propertyData.tokenSymbol,
			};
			
			// Build meta-transaction fields (no signature)
			const metaTxBase = await eip712Utils.buildListPropertyMetaTx(
				userAddress,
				normalizedData,
				this.propertyMarketplace,
				this.forwarder,
				chainId,
                deadline
            );
			
			// Attach user signature (provided by frontend)
			const metaTx = { ...metaTxBase, signature: userSignature };
            
            // Execute meta-transaction
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
				this.forwarder,
                this.relayer
            );
            
            return {
                success: true,
                transactionHash: result.transactionHash,
                propertyId: await this.getLatestPropertyId(userAddress)
            };
            
        } catch (error) {
            console.error('Property listing failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Property booking with meta-transaction
	async bookProperty(userAddress, userSignature, bookingData, deadlineOverride) {
        try {
			if (!this.relayer) {
				return { success: false, error: 'Relayer not configured' };
			}
			const deadline = Number(deadlineOverride) || (Math.floor(Date.now() / 1000) + 3600); // use provided deadline if available
			const chainId = this.getChainId();
			
			// Build meta-transaction fields (no signature)
			const metaTxBase = await eip712Utils.buildBookingMetaTx(
				userAddress,
				bookingData,
				this.bookingManager,
				this.forwarder,
				chainId,
                deadline
            );
			
			// Attach user signature (provided by frontend)
			const metaTx = { ...metaTxBase, signature: userSignature };
			
			// Pre-flight simulate to surface revert reasons
			const sim = await eip712Utils.simulateMetaTransaction(metaTx, this.forwarder, this.provider);
			if (!sim.ok) {
				return { success: false, error: sim.error };
			}
            
            // Execute meta-transaction
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
				this.forwarder,
                this.relayer
            );
            
            return {
                success: true,
                transactionHash: result.transactionHash,
                bookingId: await this.getLatestBookingId(userAddress)
            };
            
        } catch (error) {
            console.error('Property booking failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Helper methods
    async getLatestPropertyId(owner) {
        const propertyIds = await this.propertyMarketplace.getAllPropertyIds();
        return propertyIds[propertyIds.length - 1];
    }
    
    async getLatestBookingId(guest) {
        const bookingIds = await this.bookingManager.getGuestBookings(guest);
        return bookingIds[bookingIds.length - 1];
    }
    
    // Get user's nonce
    async getUserNonce(userAddress) {
		return await eip712Utils.getForwarderNonceSafe(this.forwarder, userAddress);
    }
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize blockchain service
const blockchainService = new BlockchainService();

// Initialize event listener
const eventListener = new EventListener();

// Initialize booking service (for fiat bookings)
const bookingService = new BookingService();

// Initialize crypto payment service (EURC only)
const cryptoPaymentService = new CryptoPaymentService({
    provider: blockchainService.provider,
});

// Initialize custodial signer (for meta-transactions on behalf of users)
const custodialSigner = new CustodialSigner({
    strapiBaseUrl: process.env.STRAPI_BASE_URL || 'http://localhost:1337',
    strapiToken: process.env.STRAPI_API_TOKEN,
});

// Initialize property sync service
const propertySyncService = new PropertySyncService();

// Initialize CDP wallet service (for host payouts)
const cdpWalletService = new CDPWalletService({
    network: process.env.CDP_NETWORK || 'base-sepolia',
    webhookUrl: process.env.CDP_WEBHOOK_URL,
});

// Initialize payout service (for custodial -> CDP transfers)
const payoutService = new PayoutService();

// Routes
app.get('/health', async (req, res) => {
    try {
        const currentBlock = await blockchainService.provider.getBlockNumber();
        res.json({
            status: 'healthy',
            network: deploymentInfo.network || 'unknown',
            chainId: deploymentInfo.chainId,
            contracts: deploymentInfo.contracts,
            lastBlock: currentBlock,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get user's nonce
app.get('/api/nonce/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const nonce = await blockchainService.getUserNonce(address);
        res.json({ nonce: nonce.toString() });
    } catch (error) {
        console.error('Error getting nonce:', error);
        res.status(500).json({ error: 'Failed to get nonce' });
    }
});

// Build typed-data for property listing (frontend signature)
app.post('/api/properties/list/typed-data', async (req, res) => {
	try {
		const { userAddress, propertyData, deadlineSeconds } = req.body;
		if (!userAddress || !propertyData) {
			return res.status(400).json({ error: 'Missing required fields' });
		}
		const deadline = Math.floor(Date.now() / 1000) + (Number(deadlineSeconds) || 3600);
		const chainId = blockchainService.getChainId();
		const normalizedData = {
			uri: propertyData.uri,
			pricePerNight: typeof propertyData.pricePerNight === 'bigint'
				? propertyData.pricePerNight
				: ethers.parseEther(propertyData.pricePerNight.toString()),
			tokenName: propertyData.tokenName,
			tokenSymbol: propertyData.tokenSymbol,
		};
		const metaTxBase = await eip712Utils.buildListPropertyMetaTx(
			userAddress,
			normalizedData,
			blockchainService.propertyMarketplace,
			blockchainService.forwarder,
			chainId,
			deadline
		);
		const typed = blockchainService.buildTypedData(metaTxBase);
		// Serialize BigInt fields for JSON
		const metaTxJson = {
			from: metaTxBase.from,
			to: metaTxBase.to,
			value: metaTxBase.value.toString(),
			data: metaTxBase.data,
			nonce: metaTxBase.nonce.toString(),
			deadline: metaTxBase.deadline
		};
		const typedJson = {
			domain: typed.domain,
			types: typed.types,
			message: {
				from: typed.message.from,
				to: typed.message.to,
				value: metaTxBase.value.toString(),
				data: typed.message.data,
				nonce: metaTxBase.nonce.toString(),
				deadline: typed.message.deadline
			}
		};
		res.json({
			forwarder: deploymentInfo.contracts.MetaTransactionForwarder,
			chainId,
			metaTx: metaTxJson,
			typedData: typedJson
		});
	} catch (error) {
		console.error('Error building typed-data (list):', error);
		res.status(500).json({ error: 'Failed to build typed data' });
	}
});

// Build typed-data for booking (frontend signature)
app.post('/api/bookings/create/typed-data', async (req, res) => {
	try {
		const { userAddress, bookingData, deadlineSeconds } = req.body;
		if (!userAddress || !bookingData) {
			return res.status(400).json({ error: 'Missing required fields' });
		}
		const deadline = Math.floor(Date.now() / 1000) + (Number(deadlineSeconds) || 3600);
		const chainId = blockchainService.getChainId();
		const metaTxBase = await eip712Utils.buildBookingMetaTx(
			userAddress,
			bookingData,
			blockchainService.bookingManager,
			blockchainService.forwarder,
			chainId,
			deadline
		);
		const typed = blockchainService.buildTypedData(metaTxBase);
		const metaTxJson = {
			from: metaTxBase.from,
			to: metaTxBase.to,
			value: metaTxBase.value.toString(),
			data: metaTxBase.data,
			nonce: metaTxBase.nonce.toString(),
			deadline: metaTxBase.deadline
		};
		const typedJson = {
			domain: typed.domain,
			types: typed.types,
			message: {
				from: typed.message.from,
				to: typed.message.to,
				value: metaTxBase.value.toString(),
				data: typed.message.data,
				nonce: metaTxBase.nonce.toString(),
				deadline: typed.message.deadline
			}
		};
		res.json({
			forwarder: deploymentInfo.contracts.MetaTransactionForwarder,
			chainId,
			metaTx: metaTxJson,
			typedData: typedJson
		});
	} catch (error) {
		console.error('Error building typed-data (booking):', error);
		res.status(500).json({ error: 'Failed to build typed data' });
	}
});

// List a property (gasless transaction)
app.post('/api/properties/list', async (req, res) => {
    try {
		const { userAddress, signature, propertyData, meta } = req.body;
        
        // Validate input
        if (!userAddress || !signature || !propertyData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
		if (!blockchainService.relayer) {
			return res.status(503).json({ error: 'Relayer not configured' });
		}
        
        console.log('📝 Property listing request:', {
            userAddress,
            propertyData,
            signature: signature.substring(0, 66) + '...'
        });
        
        // Execute blockchain transaction
		const result = await blockchainService.listProperty(userAddress, signature, propertyData, meta?.deadline);
        
        if (result.success) {
            console.log('✅ Property listed successfully:', result);
            res.json({
                success: true,
                propertyId: result.propertyId,
                transactionHash: result.transactionHash
            });
        } else {
            console.log('❌ Property listing failed:', result.error);
            res.status(400).json({ error: result.error });
        }
        
    } catch (error) {
        console.error('Property listing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Book a property (gasless transaction)
app.post('/api/bookings/create', async (req, res) => {
    try {
		const { userAddress, signature, bookingData, meta } = req.body;
        
        // Validate input
        if (!userAddress || !signature || !bookingData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
		if (!blockchainService.relayer) {
			return res.status(503).json({ error: 'Relayer not configured' });
		}
        
        console.log('📅 Booking request:', {
            userAddress,
            bookingData,
            signature: signature.substring(0, 66) + '...'
        });
        
        // Execute blockchain transaction
		const result = await blockchainService.bookProperty(userAddress, signature, bookingData, meta?.deadline);
        
        if (result.success) {
            console.log('✅ Property booked successfully:', result);
            res.json({
                success: true,
                bookingId: result.bookingId,
                transactionHash: result.transactionHash
            });
        } else {
            console.log('❌ Property booking failed:', result.error);
            res.status(400).json({ error: result.error });
        }
        
    } catch (error) {
        console.error('Property booking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all properties (from blockchain)
app.get('/api/properties', async (req, res) => {
    try {
        const propertyIds = await blockchainService.propertyMarketplace.getAllPropertyIds();
        const properties = [];
        
        for (const propertyId of propertyIds) {
            const propertyData = await blockchainService.propertyMarketplace.properties(propertyId);
            const [id, tokenAddress, owner, pricePerNight, isActive, propertyURI] = propertyData;
 
			// Resolve original owner from event listener cache if available
			let ownerResolved = owner;
			try {
				if (eventListener && eventListener.originalOwners && eventListener.originalOwners.has(id)) {
					ownerResolved = eventListener.originalOwners.get(id);
				}
			} catch (_) {}
 
			// Attempt to lookup owner name in Strapi by walletAddress
			let ownerName = null;
			try {
				const baseURL = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
				const token = process.env.STRAPI_API_TOKEN;
				const resp = await fetch(`${baseURL}/api/users?filters[walletAddress][$containsi]=${ownerResolved}&pagination[pageSize]=1`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				});
				if (resp.ok) {
					const users = await resp.json();
					if (Array.isArray(users) && users.length > 0) {
						ownerName = users[0].username || users[0].email || null;
					}
				}
			} catch (_) {}
            
            properties.push({
                propertyId: id,
                tokenAddress,
                owner,
				ownerResolved,
				ownerName,
                pricePerNight: pricePerNight.toString(),
                isActive,
                propertyURI
            });
        }
        
        res.json(properties);
        
    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's bookings
app.get('/api/bookings/user/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const bookingIds = await blockchainService.bookingManager.getGuestBookings(address);
        const bookings = [];

        for (const bookingId of bookingIds) {
            const bookingData = await blockchainService.bookingManager.bookings(bookingId);
            bookings.push({
                bookingId: bookingData.bookingId.toString(),
                propertyId: bookingData.propertyId,
                guest: bookingData.guest,
                checkInDate: bookingData.checkInDate.toString(),
                checkOutDate: bookingData.checkOutDate.toString(),
                totalAmount: bookingData.totalAmount.toString(),
                status: bookingData.status.toString()
            });
        }

        res.json(bookings);

    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create fiat booking (called by payment server after successful payment)
app.post('/api/bookings/create-fiat', async (req, res) => {
    try {
        const { userId, propertyId, checkInDate, checkOutDate, totalAmount, paymentReference, metadata } = req.body;

        // Validate required fields
        if (!userId || !propertyId || !checkInDate || !checkOutDate || !totalAmount || !paymentReference) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if booking service is ready
        if (!bookingService.isReady()) {
            return res.status(503).json({
                error: 'Booking service not ready',
                status: bookingService.getStatus()
            });
        }

        console.log('💳 Fiat booking request:', {
            userId,
            propertyId,
            checkInDate,
            checkOutDate,
            totalAmount,
            paymentReference
        });

        // Create the on-chain booking
        const result = await bookingService.createPaidBooking({
            userId,
            propertyId,
            checkInDate: Number(checkInDate),
            checkOutDate: Number(checkOutDate),
            totalAmount,
            paymentReference,
            metadata: metadata || {}
        });

        if (result.success) {
            console.log('✅ Fiat booking created:', result);
            res.json(result);
        } else {
            console.log('❌ Fiat booking failed:', result.error);
            res.status(400).json({ error: result.error });
        }

    } catch (error) {
        console.error('Fiat booking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get booking service status
app.get('/api/bookings/service-status', (req, res) => {
    res.json(bookingService.getStatus());
});

// ===========================================
// EURC BOOKING ENDPOINTS
// ===========================================

// Create EURC booking (on-chain payment with escrow)
app.post('/api/bookings/create-eurc', async (req, res) => {
    try {
        const { userId, propertyId, checkInDate, checkOutDate, totalAmountEURC, metadata } = req.body;

        // Validate required fields
        if (!userId || !propertyId || !checkInDate || !checkOutDate || !totalAmountEURC) {
            return res.status(400).json({
                error: 'Missing required fields: userId, propertyId, checkInDate, checkOutDate, totalAmountEURC'
            });
        }

        // Check if EURC booking is ready
        if (!bookingService.isEURCReady()) {
            return res.status(503).json({
                error: 'EURC booking service not ready',
                status: bookingService.getStatus()
            });
        }

        console.log('💶 EURC booking request:', {
            userId,
            propertyId,
            checkInDate,
            checkOutDate,
            totalAmountEURC: ethers.formatUnits(totalAmountEURC, 6) + ' EURC'
        });

        // Create the EURC booking
        const result = await bookingService.createEURCBooking({
            userId,
            propertyId,
            checkInDate: Number(checkInDate),
            checkOutDate: Number(checkOutDate),
            totalAmountEURC,
            metadata: metadata || {}
        });

        if (result.success) {
            console.log('✅ EURC booking created:', result);
            res.json(result);
        } else {
            console.log('❌ EURC booking failed:', result.error);
            res.status(400).json({ error: result.error });
        }

    } catch (error) {
        console.error('EURC booking error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get user's EURC balance
app.get('/api/eurc/balance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!bookingService.isEURCReady()) {
            return res.status(503).json({
                error: 'EURC service not ready'
            });
        }

        const balanceInfo = await bookingService.getUserEURCBalance(parseInt(userId));
        res.json(balanceInfo);

    } catch (error) {
        console.error('EURC balance error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get EURC token info
app.get('/api/eurc/info', async (req, res) => {
    try {
        if (!blockchainService.eurcToken) {
            return res.status(503).json({ error: 'EURC token not configured' });
        }

        const [symbol, decimals] = await Promise.all([
            blockchainService.eurcToken.symbol(),
            blockchainService.eurcToken.decimals()
        ]);

        res.json({
            address: await blockchainService.eurcToken.getAddress(),
            symbol,
            decimals: Number(decimals),
            bookingManagerAddress: deploymentInfo.contracts.BookingManager,
            treasuryAddress: deploymentInfo.treasury || deploymentInfo.deployer
        });

    } catch (error) {
        console.error('EURC info error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ===========================================
// CRYPTO PAYMENT ENDPOINTS (EURC Only)
// ===========================================

// Initialize an EURC payment (user sends to their custodial wallet, then we trigger meta-tx)
app.post('/api/payments/eurc/init', async (req, res) => {
    try {
        const { userId, propertyId, checkInDate, checkOutDate, totalAmountEURC, metadata } = req.body;

        // Validate required fields
        if (!userId || !propertyId || !checkInDate || !checkOutDate || !totalAmountEURC) {
            return res.status(400).json({ error: 'Missing required fields: userId, propertyId, checkInDate, checkOutDate, totalAmountEURC' });
        }

        // Check if crypto payment service is ready
        if (!cryptoPaymentService.isReady()) {
            return res.status(503).json({
                error: 'Payment service not ready. Check WALLET_MASTER_MNEMONIC configuration.'
            });
        }

        if (!cryptoPaymentService.eurcToken) {
            return res.status(503).json({
                error: 'EURC payment service not ready. EURC token not configured.'
            });
        }

        // Get user's custodial wallet address
        let custodialWalletAddress;
        try {
            const userWallet = custodialSigner.deriveUserWallet(userId);
            custodialWalletAddress = userWallet.address;
        } catch (walletError) {
            console.error('Failed to derive custodial wallet:', walletError);
            return res.status(500).json({ error: 'Failed to get custodial wallet address' });
        }

        console.log('💶 EURC payment init request:', {
            userId,
            propertyId,
            checkInDate,
            checkOutDate,
            totalAmountEURC,
            custodialWalletAddress,
        });

        // Initialize EURC payment session with custodial wallet
        const payment = await cryptoPaymentService.initializeEURCPayment({
            userId,
            propertyId,
            checkInDate: Number(checkInDate),
            checkOutDate: Number(checkOutDate),
            totalAmountEURC,
            custodialWalletAddress,
            metadata: metadata || {},
        });

        res.json({
            success: true,
            ...payment,
        });

    } catch (error) {
        console.error('EURC payment init error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get crypto payment status
app.get('/api/payments/crypto/status/:paymentId', (req, res) => {
    try {
        const { paymentId } = req.params;
        const status = cryptoPaymentService.getPaymentStatus(parseInt(paymentId));

        if (!status) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json(status);

    } catch (error) {
        console.error('Crypto payment status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel a crypto payment (with optional refund)
app.post('/api/payments/crypto/cancel/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { refundAddress } = req.body;

        const result = await cryptoPaymentService.cancelPayment(parseInt(paymentId), refundAddress);

        if (result.success) {
            res.json({ success: true, message: 'Payment cancelled' });
        } else {
            res.status(400).json({ error: result.error });
        }

    } catch (error) {
        console.error('Crypto payment cancel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all pending crypto payments (admin/debug)
app.get('/api/payments/crypto/pending', (req, res) => {
    try {
        const payments = cryptoPaymentService.getAllPendingPayments();
        res.json({ payments });
    } catch (error) {
        console.error('Crypto pending payments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get crypto payment service status
app.get('/api/payments/crypto/service-status', (req, res) => {
    res.json({
        isReady: cryptoPaymentService.isReady(),
        isMonitoring: cryptoPaymentService.isMonitoring,
        pendingCount: cryptoPaymentService.pendingPayments.size,
        treasuryAddress: cryptoPaymentService.treasuryAddress,
    });
});

// ===========================================
// CDP WALLET ENDPOINTS (Host Payouts)
// ===========================================

// Create CDP wallet for a host
app.post('/api/host/wallet/create', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        if (!cdpWalletService.isReady()) {
            return res.status(503).json({
                error: 'CDP wallet service not ready. Check CDP API key configuration.',
                status: cdpWalletService.getStatus(),
            });
        }

        console.log(`🔐 CDP wallet creation request for user ${userId}`);

        const result = await cdpWalletService.createHostWallet(userId);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({
            success: true,
            walletId: result.walletId,
            address: result.address,
            existing: result.existing || false,
        });
    } catch (error) {
        console.error('CDP wallet creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get host wallet details and balance
app.get('/api/host/wallet/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!cdpWalletService.isReady()) {
            return res.status(503).json({
                error: 'CDP wallet service not ready',
                status: cdpWalletService.getStatus(),
            });
        }

        const result = await cdpWalletService.getHostWallet(parseInt(userId));

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        // Also fetch EURC balance directly using ethers for reliability
        if (result.address && blockchainService.eurcToken) {
            try {
                const eurcBalance = await blockchainService.eurcToken.balanceOf(result.address);
                const formattedEurc = ethers.formatUnits(eurcBalance, 6);

                // Ensure balances object exists and add eurc
                result.balances = result.balances || {};
                result.balances.eurc = formattedEurc;
            } catch (balanceError) {
                console.warn('Could not fetch EURC balance:', balanceError.message);
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Get CDP wallet error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Transfer EURC from host wallet (gasless)
app.post('/api/host/wallet/transfer', async (req, res) => {
    try {
        const { userId, toAddress, amount } = req.body;

        if (!userId || !toAddress || !amount) {
            return res.status(400).json({ error: 'Missing required fields: userId, toAddress, amount' });
        }

        if (!cdpWalletService.isReady()) {
            return res.status(503).json({
                error: 'CDP wallet service not ready',
                status: cdpWalletService.getStatus(),
            });
        }

        console.log(`💶 CDP EURC transfer request: ${amount} EURC from user ${userId} to ${toAddress}`);

        const result = await cdpWalletService.transferEURC(parseInt(userId), toAddress, amount);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('CDP transfer error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get CDP wallet service status
app.get('/api/host/wallet/service-status', (req, res) => {
    res.json(cdpWalletService.getStatus());
});

// Set up webhook for a host's CDP wallet
app.post('/api/host/wallet/webhook', async (req, res) => {
    try {
        const { userId, callbackUrl } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        if (!cdpWalletService.isReady()) {
            return res.status(503).json({
                error: 'CDP wallet service not ready',
                status: cdpWalletService.getStatus(),
            });
        }

        // Get host's CDP wallet address
        const walletResult = await cdpWalletService.getHostWallet(parseInt(userId));
        if (!walletResult.success || !walletResult.address) {
            return res.status(404).json({ error: 'Host CDP wallet not found' });
        }

        console.log(`🔔 Setting up CDP webhook for user ${userId} (${walletResult.address})`);

        // Set up webhook for incoming transfers
        const result = await cdpWalletService.setupTransferWebhook(walletResult.address, callbackUrl);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        res.json({
            success: true,
            webhookId: result.webhookId,
            address: walletResult.address,
        });
    } catch (error) {
        console.error('CDP webhook setup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// CDP Webhook callback endpoint
app.post('/api/webhooks/cdp/transfer', async (req, res) => {
    try {
        const payload = req.body;
        const signature = req.headers['x-cdp-signature'];

        // Verify webhook signature (TODO: implement proper verification)
        if (!cdpWalletService.verifyWebhookSignature(payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        console.log('📥 CDP webhook received:', JSON.stringify(payload, null, 2));

        // Process the webhook event
        const result = await cdpWalletService.processWebhookEvent(payload);

        res.json({ received: true, handled: result.handled });
    } catch (error) {
        console.error('CDP webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===========================================
// PAYOUT SERVICE ENDPOINTS (Custodial -> CDP)
// ===========================================

// Get payout status for a user
app.get('/api/payouts/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!payoutService.isReady()) {
            return res.status(503).json({
                error: 'Payout service not ready',
                status: payoutService.getStatus(),
            });
        }

        const result = await payoutService.getPayoutStatus(parseInt(userId));

        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Payout status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manually trigger payout for a user (transfer all EURC from custodial to CDP)
app.post('/api/payouts/manual', async (req, res) => {
    try {
        const { userId, amount } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        if (!payoutService.isReady()) {
            return res.status(503).json({
                error: 'Payout service not ready',
                status: payoutService.getStatus(),
            });
        }

        console.log(`💸 Manual payout request for user ${userId}, amount: ${amount || 'all'}`);

        const result = await payoutService.manualPayout(parseInt(userId), amount || 'all');

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Manual payout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get payout service status
app.get('/api/payouts/service-status', (req, res) => {
    res.json(payoutService.getStatus());
});

// Get escrow balance for a host (funds in active bookings not yet released)
app.get('/api/payouts/escrow/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const strapiUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        // Get the user's properties
        const userResponse = await fetch(`${strapiUrl}/api/users/${userId}?populate=properties`, {
            headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {},
        });

        if (!userResponse.ok) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = await userResponse.json();
        const propertyIds = (user.properties || []).map(p => p.id);

        if (propertyIds.length === 0) {
            return res.json({
                success: true,
                escrowBalance: '0',
                bookings: [],
            });
        }

        // Get active bookings (Upcoming or Active status) for these properties
        const propertyFilter = propertyIds.map(id => `filters[property][id][$in]=${id}`).join('&');
        const bookingsUrl = `${strapiUrl}/api/proeprty-bookings?${propertyFilter}&filters[BookingStatus][$in][0]=Upcoming&filters[BookingStatus][$in][1]=Active&populate=property&sort=StartDate:asc`;

        const bookingsResponse = await fetch(bookingsUrl, {
            headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {},
        });

        if (!bookingsResponse.ok) {
            return res.status(500).json({ error: 'Failed to fetch bookings' });
        }

        const bookingsResult = await bookingsResponse.json();
        const bookings = bookingsResult.data || [];

        // Calculate total escrow and format bookings
        let totalEscrow = 0;
        const escrowBookings = [];

        for (const booking of bookings) {
            const attrs = booking.attributes || booking;
            const property = attrs.property?.data?.attributes || attrs.property || {};

            // Calculate host amount (total - platform fee)
            // Platform fee is 0.5% (5/1000)
            const totalPaid = parseFloat(attrs.TotalPaid || 0);
            const platformFee = totalPaid * 0.005;
            const hostAmount = totalPaid - platformFee;

            totalEscrow += hostAmount;

            escrowBookings.push({
                bookingId: attrs.blockchainBookingId,
                propertyTitle: property.Title || 'Unknown Property',
                checkIn: attrs.StartDate,
                checkOut: attrs.EndDate,
                status: attrs.BookingStatus,
                totalPaid: totalPaid.toString(),
                hostAmount: hostAmount.toString(),
                guestName: 'Guest', // Privacy - don't expose guest details
            });
        }

        res.json({
            success: true,
            escrowBalance: totalEscrow.toString(),
            bookingCount: escrowBookings.length,
            bookings: escrowBookings,
        });
    } catch (error) {
        console.error('Escrow balance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get payout history for a host
app.get('/api/payouts/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        const strapiUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        // First get the user to find their properties
        const userResponse = await fetch(`${strapiUrl}/api/users/${userId}?populate=properties`, {
            headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {},
        });

        if (!userResponse.ok) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = await userResponse.json();
        const propertyIds = (user.properties || []).map(p => p.id);

        if (propertyIds.length === 0) {
            return res.json({
                success: true,
                payouts: [],
                total: 0,
                message: 'No properties found for this host',
            });
        }

        // Get bookings for these properties with payout info
        // Filter for bookings that have a payoutStatus set (completed, failed, skipped, etc.)
        const propertyFilter = propertyIds.map(id => `filters[property][id][$in]=${id}`).join('&');
        const bookingsUrl = `${strapiUrl}/api/proeprty-bookings?${propertyFilter}&filters[payoutStatus][$ne]=pending&filters[payoutStatus][$notNull]=true&populate=property&sort=payoutDate:desc&pagination[start]=${offset}&pagination[limit]=${limit}`;

        const bookingsResponse = await fetch(bookingsUrl, {
            headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {},
        });

        if (!bookingsResponse.ok) {
            return res.status(500).json({ error: 'Failed to fetch bookings' });
        }

        const bookingsResult = await bookingsResponse.json();
        const bookings = bookingsResult.data || [];
        const total = bookingsResult.meta?.pagination?.total || bookings.length;

        // Format payout history
        const payouts = bookings.map(booking => {
            const attrs = booking.attributes || booking;
            const property = attrs.property?.data?.attributes || attrs.property || {};

            return {
                bookingId: attrs.blockchainBookingId,
                propertyTitle: property.Title || 'Unknown Property',
                checkIn: attrs.StartDate,
                checkOut: attrs.EndDate,
                totalPaid: attrs.TotalPaid,
                payoutAmount: attrs.payoutAmount,
                payoutStatus: attrs.payoutStatus,
                payoutTxHash: attrs.payoutTxHash,
                payoutDate: attrs.payoutDate,
                payoutDestination: attrs.payoutDestination,
            };
        });

        res.json({
            success: true,
            payouts,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    } catch (error) {
        console.error('Payout history error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user's payout preference
app.put('/api/payouts/preference/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { payoutPreference } = req.body;

        if (!payoutPreference) {
            return res.status(400).json({ error: 'Missing payoutPreference' });
        }

        const validPreferences = ['cdp_wallet', 'external_wallet', 'custodial'];
        if (!validPreferences.includes(payoutPreference)) {
            return res.status(400).json({
                error: `Invalid payoutPreference. Must be one of: ${validPreferences.join(', ')}`
            });
        }

        const strapiUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        // Update user's payout preference in CMS
        const response = await fetch(`${strapiUrl}/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {}),
            },
            body: JSON.stringify({ payoutPreference }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const updatedUser = await response.json();

        // If switching to cdp_wallet, ensure they have a CDP wallet
        if (payoutPreference === 'cdp_wallet') {
            const cdpWallet = updatedUser.cdpWalletAddress;
            if (!cdpWallet && cdpWalletService.isReady()) {
                console.log(`🔐 Auto-creating CDP wallet for user ${userId} (payout preference changed)`);
                const createResult = await cdpWalletService.createHostWallet(parseInt(userId));
                if (createResult.success) {
                    console.log(`   ✅ CDP wallet created: ${createResult.address}`);
                }
            }
        }

        res.json({
            success: true,
            userId: parseInt(userId),
            payoutPreference,
            cdpWalletAddress: updatedUser.cdpWalletAddress || null,
        });
    } catch (error) {
        console.error('Update payout preference error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===========================================
// PROPERTY SYNC ENDPOINTS (CMS → Blockchain)
// ===========================================

// Sync a new property from CMS to blockchain
app.post('/api/properties/sync/new', async (req, res) => {
    try {
        const { propertyId } = req.body;

        if (!propertyId) {
            return res.status(400).json({ error: 'Missing propertyId' });
        }

        if (!propertySyncService.isReady()) {
            return res.status(503).json({
                error: 'Property sync service not ready',
                status: propertySyncService.getStatus()
            });
        }

        console.log(`🔄 Property sync request (new): ${propertyId}`);

        // Fetch the property from Strapi
        const strapiUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        const propertyResponse = await fetch(
            `${strapiUrl}/api/properties/${propertyId}?populate=*`,
            {
                headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {},
            }
        );

        if (!propertyResponse.ok) {
            return res.status(404).json({ error: 'Property not found in CMS' });
        }

        const propertyJson = await propertyResponse.json();

        // Strapi v5: data is flat, not nested under attributes
        const propertyData = propertyJson.data?.attributes || propertyJson.data || propertyJson;
        propertyData.id = propertyId;
        propertyData.documentId = propertyJson.data?.documentId || propertyJson.data?.id || propertyId;

        // Ensure BlockchainPropertyId is captured (Strapi v5 may have it at different levels)
        if (!propertyData.BlockchainPropertyId) {
            propertyData.BlockchainPropertyId = propertyJson.data?.BlockchainPropertyId ||
                                                 propertyJson.data?.attributes?.BlockchainPropertyId;
        }

        // CRITICAL: Check if already has blockchain ID BEFORE syncing
        if (propertyData.BlockchainPropertyId) {
            console.log(`⏭️ Property ${propertyId} already has BlockchainPropertyId: ${propertyData.BlockchainPropertyId} - skipping sync`);
            return res.json({
                success: true,
                alreadySynced: true,
                blockchainPropertyId: propertyData.BlockchainPropertyId
            });
        }

        // Sync to blockchain
        const result = await propertySyncService.syncNewProperty(propertyData);

        if (result.success) {
            console.log(`✅ Property synced to blockchain: ${result.blockchainPropertyId}`);

            // Update CMS with BlockchainPropertyId
            if (result.blockchainPropertyId && !result.alreadySynced) {
                try {
                    const updateUrl = `${strapiUrl}/api/properties/${propertyData.documentId || propertyId}`;
                    const updateResponse = await fetch(updateUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${strapiToken}`,
                        },
                        body: JSON.stringify({
                            data: {
                                BlockchainPropertyId: result.blockchainPropertyId,
                            },
                        }),
                    });
                    if (updateResponse.ok) {
                        console.log(`✅ Updated CMS with BlockchainPropertyId: ${result.blockchainPropertyId}`);
                    } else {
                        console.warn(`⚠️ Failed to update CMS with BlockchainPropertyId`);
                    }
                } catch (updateErr) {
                    console.warn(`⚠️ Failed to update CMS: ${updateErr.message}`);
                }
            }

            res.json(result);
        } else {
            console.log(`❌ Property sync failed: ${result.error}`);
            res.status(400).json({ error: result.error });
        }

    } catch (error) {
        console.error('Property sync error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Sync a property update from CMS to blockchain
app.post('/api/properties/sync/update', async (req, res) => {
    try {
        const { propertyId } = req.body;

        if (!propertyId) {
            return res.status(400).json({ error: 'Missing propertyId' });
        }

        if (!propertySyncService.isReady()) {
            return res.status(503).json({
                error: 'Property sync service not ready',
                status: propertySyncService.getStatus()
            });
        }

        console.log(`🔄 Property sync request (update): ${propertyId}`);

        // Fetch the property from Strapi
        const strapiUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
        const strapiToken = process.env.STRAPI_API_TOKEN;

        const propertyResponse = await fetch(
            `${strapiUrl}/api/properties/${propertyId}?populate=*`,
            {
                headers: strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {},
            }
        );

        if (!propertyResponse.ok) {
            return res.status(404).json({ error: 'Property not found in CMS' });
        }

        const propertyJson = await propertyResponse.json();

        // Strapi v5: data is flat, not nested under attributes
        const propertyData = propertyJson.data?.attributes || propertyJson.data || propertyJson;
        propertyData.id = propertyId;
        propertyData.documentId = propertyJson.data?.documentId || propertyJson.data?.id || propertyId;

        // Ensure BlockchainPropertyId is captured (Strapi v5 may have it at different levels)
        if (!propertyData.BlockchainPropertyId) {
            propertyData.BlockchainPropertyId = propertyJson.data?.BlockchainPropertyId ||
                                                 propertyJson.data?.attributes?.BlockchainPropertyId;
        }

        // Sync to blockchain
        const result = await propertySyncService.syncPropertyUpdate(propertyData);

        if (result.success) {
            if (result.skipped) {
                console.log(`⏭️ Property update skipped: ${result.reason}`);
            } else if (result.noChanges) {
                console.log(`✅ No blockchain-relevant changes`);
            } else {
                console.log(`✅ Property update synced to blockchain`);
            }
            res.json(result);
        } else {
            console.log(`❌ Property update sync failed: ${result.error}`);
            res.status(400).json({ error: result.error });
        }

    } catch (error) {
        console.error('Property update sync error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get property sync service status
app.get('/api/properties/sync/status', (req, res) => {
    res.json(propertySyncService.getStatus());
});

// Bulk sync all properties from CMS to blockchain
app.post('/api/properties/sync/bulk', async (req, res) => {
    try {
        const { forceResync } = req.body || {};

        console.log(`🔄 Bulk sync requested (forceResync: ${!!forceResync})`);

        const result = await propertySyncService.bulkSyncFromCMS({ forceResync });

        if (result.success || result.synced > 0) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Bulk sync error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Manual event processing endpoint (for testing)
app.post('/api/events/process', async (req, res) => {
    try {
        const { fromBlock, toBlock } = req.body;
        
        if (!fromBlock || !toBlock) {
            return res.status(400).json({ error: 'Missing fromBlock and toBlock parameters' });
        }
        
        console.log(`🔄 Manually processing events from block ${fromBlock} to ${toBlock}`);
        
        const events = await eventListener.getAllEvents(parseInt(fromBlock), parseInt(toBlock));
        console.log(`📊 Found ${events.length} events to process`);
        
        for (const event of events) {
            await eventListener.processEvent(event);
        }
        
        res.json({ 
            success: true, 
            eventsProcessed: events.length,
            message: `Processed ${events.length} events from block ${fromBlock} to ${toBlock}`
        });
        
    } catch (error) {
        console.error('Manual event processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manual reconciliation endpoint
app.post('/api/reconcile', async (req, res) => {
	try {
		const { userAddress } = req.body || {};
		const result = await eventListener.reconcileChainToStrapi(userAddress);
		res.json({ success: true, ...result });
	} catch (error) {
		res.status(500).json({ success: false, error: error?.message || String(error) });
	}
});

// Get event listener status
app.get('/api/events/status', (req, res) => {
    res.json({
        isRunning: eventListener.isRunning,
        lastProcessedBlock: eventListener.lastProcessedBlock,
        strapiConfig: {
            baseURL: eventListener.strapiConfig.baseURL,
            hasApiToken: !!eventListener.strapiConfig.apiToken
        }
    });
});

// Get idempotency statistics
app.get('/api/events/idempotency', (req, res) => {
	try {
		const stats = eventListener.getIdempotencyStats();
		res.json({
			success: true,
			stats: {
				...stats,
				memoryUsage: process.memoryUsage(),
				uptime: process.uptime()
			}
		});
	} catch (error) {
		console.error('Error getting idempotency stats:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Reset idempotency tracking (for testing)
app.post('/api/events/reset-idempotency', (req, res) => {
	try {
		eventListener.resetIdempotencyTracking();
		res.json({ 
			success: true, 
			message: 'Idempotency tracking reset successfully' 
		});
	} catch (error) {
		console.error('Error resetting idempotency tracking:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Pin property metadata to IPFS (Pinata)
app.post('/api/ipfs/pin-property', async (req, res) => {
	try {
		const payload = req.body || {};
		const metadata = payload.metadata || payload;
		if (!metadata || typeof metadata !== 'object') {
			return res.status(400).json({ error: 'Missing metadata object' });
		}
		if (!metadata.title && !metadata.name) {
			console.warn('pin-property: metadata missing title/name');
		}

		const jwt = process.env.PINATA_JWT;
		const apiKey = process.env.PINATA_API_KEY;
		const apiSecret = process.env.PINATA_API_SECRET;
		if (!jwt && (!apiKey || !apiSecret)) {
			return res.status(501).json({ error: 'IPFS pinning not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET.' });
		}

		const pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
		const headers = jwt
			? { Authorization: `Bearer ${jwt}` }
			: { pinata_api_key: apiKey, pinata_secret_api_key: apiSecret };
		const body = {
			pinataOptions: { cidVersion: 1 },
			pinataMetadata: { name: metadata?.title || metadata?.name || 'property-metadata' },
			pinataContent: metadata,
		};
		console.log('pin-property: pinning JSON with name:', body.pinataMetadata.name);
		const resp = await axios.post(pinataUrl, body, { headers, timeout: 20000 });
		const cid = resp?.data?.IpfsHash;
		if (!cid) {
			console.error('pin-property: unexpected response from Pinata', resp?.data);
			throw new Error('Pinata did not return a CID');
		}
		return res.json({ success: true, cid, uri: `ipfs://${cid}` });
	} catch (error) {
		const details = error?.response?.data || error.message;
		console.error('Error pinning to IPFS:', details);
		return res.status(500).json({ error: details?.error || details || 'Failed to pin metadata' });
	}
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`📊 Network: ${deploymentInfo.network} (Chain ID: ${deploymentInfo.chainId})`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📝 API endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   GET  /api/nonce/:address`);
    console.log(`   POST /api/properties/list/typed-data`);
    console.log(`   POST /api/bookings/create/typed-data`);
    console.log(`   POST /api/properties/list`);
    console.log(`   POST /api/bookings/create`);
    console.log(`   POST /api/bookings/create-fiat`);
    console.log(`   POST /api/bookings/create-eurc`);
    console.log(`   GET  /api/bookings/service-status`);
    console.log(`   GET  /api/eurc/balance/:userId`);
    console.log(`   GET  /api/eurc/info`);
    console.log(`   GET  /api/properties`);
    console.log(`   GET  /api/bookings/user/:address`);
    console.log(`   GET  /api/events/status`);
    console.log(`   GET  /api/events/idempotency`);
    console.log(`   POST /api/events/reset-idempotency`);
    console.log(`   POST /api/ipfs/pin-property`);
    console.log(`   POST /api/payments/eurc/init`);
    console.log(`   GET  /api/payments/crypto/status/:paymentId`);
    console.log(`   POST /api/payments/crypto/cancel/:paymentId`);
    console.log(`   GET  /api/payments/crypto/pending`);
    console.log(`   GET  /api/payments/crypto/service-status`);
    console.log(`   GET  /api/payouts/status/:userId`);
    console.log(`   POST /api/payouts/manual`);
    console.log(`   GET  /api/payouts/service-status`);
    console.log(`   GET  /api/payouts/history/:userId`);
    console.log(`   PUT  /api/payouts/preference/:userId`);
    console.log(`   POST /api/host/wallet/webhook`);
    console.log(`   POST /api/properties/sync/new`);
    console.log(`   POST /api/properties/sync/update`);
    console.log(`   POST /api/properties/sync/bulk`);
    console.log(`   GET  /api/properties/sync/status`);

    // Initialize booking service with blockchain connections (including EURC)
    try {
        bookingService.initialize({
            provider: blockchainService.provider,
            relayer: blockchainService.relayer,
            forwarder: blockchainService.forwarder,
            bookingManager: blockchainService.bookingManager,
            eurcToken: blockchainService.eurcToken,
            chainId: blockchainService.getChainId(),
        });
        console.log('✅ Booking service initialized:', bookingService.getStatus());
    } catch (error) {
        console.error('❌ Failed to initialize booking service:', error);
    }

    // Set EURC token on crypto payment service
    if (blockchainService.eurcToken) {
        cryptoPaymentService.setEURCToken(blockchainService.eurcToken);
    }

    // Set up EURC payment callback - when EURC payment is confirmed in custodial wallet, create booking via meta-tx
    cryptoPaymentService.onEURCPaymentConfirmed = async (payment) => {
        console.log(`💶 EURC received in custodial wallet for payment #${payment.paymentId}`);
        console.log(`   User: ${payment.userId}, Amount: ${ethers.formatUnits(payment.receivedAmountBase, 6)} EURC`);

        try {
            // Check if booking service is ready for EURC
            if (!bookingService.isEURCReady()) {
                return { success: false, error: 'EURC booking service not ready' };
            }

            // Create the on-chain booking with EURC via meta-transaction
            // This will: 1) Sign approval, 2) Execute approval, 3) Sign booking, 4) Execute booking
            // EURC goes from custodial wallet → escrow in BookingManager
            const result = await bookingService.createEURCBooking({
                userId: payment.userId,
                propertyId: payment.propertyId,
                checkInDate: payment.checkInDate,
                checkOutDate: payment.checkOutDate,
                totalAmountEURC: payment.receivedAmountBase, // EURC amount in base units (6 decimals)
                metadata: {
                    ...payment.metadata,
                    paymentMethod: 'eurc_custodial',
                    custodialWallet: payment.paymentAddress,
                    receivedAmountEURC: ethers.formatUnits(payment.receivedAmountBase, 6),
                },
            });

            // If on-chain booking succeeded, also create CMS booking record
            if (result.success) {
                try {
                    const strapiUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
                    const strapiToken = process.env.STRAPI_API_TOKEN;
                    const metadata = payment.metadata || {};

                    // Calculate booking details from metadata
                    const pricePerNight = metadata.pricePerNight || 0;
                    const checkInMoment = new Date(payment.checkInDate * 1000);
                    const checkOutMoment = new Date(payment.checkOutDate * 1000);
                    const nights = Math.ceil((checkOutMoment - checkInMoment) / (1000 * 60 * 60 * 24));
                    const totalPaid = parseFloat(ethers.formatUnits(payment.receivedAmountBase, 6));

                    const cmsBookingData = {
                        data: {
                            property: metadata.cmsPropertyId || null,
                            users_permissions_user: payment.userId, // Link to the booking user
                            StartDate: checkInMoment.toISOString().split('T')[0],
                            EndDate: checkOutMoment.toISOString().split('T')[0],
                            Guests: metadata.guests || 1,
                            Rooms: metadata.rooms || 1,
                            PriceperNight: pricePerNight,
                            NumberOfNights: nights,
                            AtlasFee: metadata.atlasFee || 0,
                            CleaningFee: metadata.cleaningFee || 0,
                            TotalPaid: totalPaid,
                            PaidBy: 'ETH', // Using ETH as closest match for crypto in CMS enum
                            BookingStatus: 'Upcoming',
                            blockchainBookingId: result.bookingId ? parseInt(result.bookingId) : null,
                            transactionHash: result.transactionHash || null,
                            ipfsUri: result.ipfsUri || null,
                            paymentReference: `eurc:${payment.paymentId}`,
                        },
                    };

                    console.log('📝 Creating CMS booking record:', cmsBookingData.data);

                    const cmsResponse = await fetch(`${strapiUrl}/api/proeprty-bookings`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(strapiToken ? { Authorization: `Bearer ${strapiToken}` } : {}),
                        },
                        body: JSON.stringify(cmsBookingData),
                    });

                    if (cmsResponse.ok) {
                        const cmsResult = await cmsResponse.json();
                        console.log('✅ CMS booking created:', cmsResult.data?.id || cmsResult.data?.documentId);
                        result.cmsBookingId = cmsResult.data?.id || cmsResult.data?.documentId;
                    } else {
                        const cmsError = await cmsResponse.text();
                        console.error('⚠️ CMS booking creation failed:', cmsError);
                        // Don't fail the whole operation - on-chain booking succeeded
                    }
                } catch (cmsError) {
                    console.error('⚠️ Error creating CMS booking:', cmsError.message);
                    // Don't fail the whole operation - on-chain booking succeeded
                }
            }

            return result;
        } catch (error) {
            console.error('Error creating EURC booking via meta-tx:', error);
            return { success: false, error: error.message };
        }
    };

    // Start crypto payment monitoring
    if (cryptoPaymentService.isReady()) {
        console.log('✅ Crypto payment service ready');
    } else {
        console.warn('⚠️ Crypto payment service not ready - check WALLET_MASTER_MNEMONIC');
    }

    // Initialize property sync service
    try {
        propertySyncService.initialize({
            provider: blockchainService.provider,
            relayer: blockchainService.relayer,
            forwarder: blockchainService.forwarder,
            propertyMarketplace: blockchainService.propertyMarketplace,
            chainId: blockchainService.getChainId(),
        });
        console.log('✅ Property sync service initialized:', propertySyncService.getStatus());
    } catch (error) {
        console.error('❌ Failed to initialize property sync service:', error);
    }

    // Initialize CDP wallet service (for host payouts)
    try {
        const cdpInitialized = await cdpWalletService.initialize();
        if (cdpInitialized) {
            console.log('✅ CDP wallet service initialized:', cdpWalletService.getStatus());

            // Link CDP wallet service to property sync service (for auto-creating host wallets)
            propertySyncService.setCDPWalletService(cdpWalletService);
        } else {
            console.warn('⚠️ CDP wallet service not configured - host payouts will use custodial wallets');
        }
    } catch (error) {
        console.error('❌ Failed to initialize CDP wallet service:', error);
    }

    // Initialize payout service (for custodial -> CDP transfers)
    try {
        payoutService.initialize({
            provider: blockchainService.provider,
            relayer: blockchainService.relayer,
            chainId: blockchainService.getChainId(),
        });
        console.log('✅ Payout service initialized:', payoutService.getStatus());
    } catch (error) {
        console.error('❌ Failed to initialize payout service:', error);
    }

    // Start event listener
    try {
        await eventListener.initialize();
        await eventListener.start();
        console.log('✅ Event listener started successfully');

        // Set up callback for booking completion to trigger host payouts
        eventListener.onBookingCompleted = async (bookingId) => {
            if (!payoutService.isReady()) {
                console.log('⚠️ Payout service not ready - skipping auto-payout');
                return;
            }

            try {
                // Get booking data from chain to find the host
                const bookingData = await blockchainService.bookingManager.bookings(bookingId);
                const hostAddress = bookingData.host;
                const hostAmount = bookingData.hostAmount;

                console.log(`💸 Booking ${bookingId} completed - processing payout to ${hostAddress}`);

                // Trigger payout from host's custodial wallet to CDP wallet (if configured)
                const result = await payoutService.processPayoutByAddress(
                    hostAddress,
                    bookingId.toString(),
                    hostAmount.toString()
                );

                if (result.success) {
                    if (result.skipped) {
                        console.log(`   ℹ️ Payout skipped: ${result.reason}`);
                    } else {
                        console.log(`   ✅ Payout transferred to CDP wallet: ${result.txHash}`);
                    }
                } else {
                    console.log(`   ⚠️ Payout failed: ${result.error}`);
                }
            } catch (error) {
                console.error(`   ❌ Error processing booking payout:`, error.message);
            }
        };
        console.log('✅ Booking completion callback configured for auto-payouts');

        // Set up periodic cleanup of processed events (every hour)
        setInterval(() => {
            eventListener.cleanupProcessedEvents();
        }, 60 * 60 * 1000); // 1 hour

        console.log('🧹 Periodic event cleanup scheduled (every hour)');

    } catch (error) {
        console.error('❌ Failed to start event listener:', error);
    }

    // Set up periodic bulk sync from CMS to blockchain (every 30 minutes)
    const BULK_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

    // Run initial bulk sync after a short delay (let services initialize)
    setTimeout(async () => {
        console.log('🔄 Running initial bulk sync from CMS to blockchain...');
        try {
            const result = await propertySyncService.bulkSyncFromCMS();
            console.log(`✅ Initial bulk sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.failed} failed`);
        } catch (error) {
            console.error('❌ Initial bulk sync failed:', error.message);
        }
    }, 10000); // 10 second delay

    // Schedule recurring bulk sync
    setInterval(async () => {
        console.log('🔄 Running scheduled bulk sync from CMS to blockchain...');
        try {
            const result = await propertySyncService.bulkSyncFromCMS();
            console.log(`✅ Scheduled bulk sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.failed} failed`);
        } catch (error) {
            console.error('❌ Scheduled bulk sync failed:', error.message);
        }
    }, BULK_SYNC_INTERVAL);

    console.log('🔄 Periodic CMS→Blockchain sync scheduled (every 30 minutes)');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down backend server...');
    eventListener.stop();
    cryptoPaymentService.stopMonitoring();
    process.exit(0);
});