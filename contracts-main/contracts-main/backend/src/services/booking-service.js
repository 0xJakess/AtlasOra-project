const { ethers } = require('ethers');
const CustodialSigner = require('./custodial-signer');
const IPFSService = require('./ipfs-service');
const eip712Utils = require('../utils/eip712-utils');

// Standard ERC-20 ABI for EURC
const ERC20_ABI = [
	'function approve(address spender, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function balanceOf(address account) view returns (uint256)',
	'function decimals() view returns (uint8)',
	'function symbol() view returns (string)',
];

/**
 * BookingService - Unified service for creating on-chain bookings
 *
 * Handles:
 * - Fiat bookings (credit card via Revolut) - recorded on-chain with paidOffChain=true
 * - EURC bookings - full on-chain payment with escrow
 *
 * This service orchestrates the entire flow:
 * 1. Pin booking metadata to IPFS
 * 2. Sign meta-transaction with user's custodial wallet
 * 3. Submit transaction via relayer
 * 4. Return transaction hash and booking ID
 */
class BookingService {
	constructor(config = {}) {
		this.custodialSigner = new CustodialSigner(config);
		this.ipfsService = new IPFSService(config);

		// These will be set by initialize()
		this.provider = null;
		this.relayer = null;
		this.forwarder = null;
		this.bookingManager = null;
		this.eurcToken = null;
		this.chainId = null;
	}

	/**
	 * Initialize the service with blockchain connections
	 * @param {Object} blockchainConfig - { provider, relayer, forwarder, bookingManager, eurcToken, chainId }
	 */
	initialize(blockchainConfig) {
		this.provider = blockchainConfig.provider;
		this.relayer = blockchainConfig.relayer;
		this.forwarder = blockchainConfig.forwarder;
		this.bookingManager = blockchainConfig.bookingManager;
		this.eurcToken = blockchainConfig.eurcToken;
		this.chainId = blockchainConfig.chainId;

		console.log('✅ BookingService initialized');
		if (this.eurcToken) {
			console.log('   💶 EURC token configured');
		}
	}

	/**
	 * Check if the service is ready
	 * @returns {boolean}
	 */
	isReady() {
		return !!(
			this.provider &&
			this.relayer &&
			this.forwarder &&
			this.bookingManager &&
			this.chainId &&
			this.custodialSigner.isAvailable() &&
			this.ipfsService.isAvailable()
		);
	}

	/**
	 * Check if EURC booking is available
	 * @returns {boolean}
	 */
	isEURCReady() {
		return this.isReady() && !!this.eurcToken;
	}

	/**
	 * Create an on-chain booking record for an external payment (fiat or crypto)
	 *
	 * @param {Object} params
	 * @param {number} params.userId - Strapi user ID
	 * @param {string} params.propertyId - Property ID (on-chain)
	 * @param {number} params.checkInDate - Unix timestamp
	 * @param {number} params.checkOutDate - Unix timestamp
	 * @param {string|number} params.totalAmount - Total amount paid
	 * @param {string} params.paymentReference - Payment reference (Revolut order ID, crypto payment ID, etc.)
	 * @param {Object} params.metadata - Additional booking metadata for IPFS
	 * @returns {Object} { success, transactionHash, bookingId, ipfsUri }
	 */
	async createPaidBooking(params) {
		const {
			userId,
			propertyId,
			checkInDate,
			checkOutDate,
			totalAmount,
			paymentReference,
			metadata = {},
		} = params;

		console.log(`📝 Creating paid booking for user ${userId}, property ${propertyId}`);

		// Validate inputs
		if (!userId || !propertyId || !checkInDate || !checkOutDate || !totalAmount || !paymentReference) {
			throw new Error('Missing required booking parameters');
		}

		if (!this.isReady()) {
			throw new Error('BookingService not properly initialized');
		}

		try {
			// Step 1: Get user's wallet
			const userWallet = await this.custodialSigner.getUserWallet(userId);
			const userAddress = userWallet.address;
			console.log(`  👤 User wallet: ${userAddress}`);

			// Step 2: Pin booking metadata to IPFS
			const ipfsData = {
				propertyId,
				checkInDate: new Date(checkInDate * 1000).toISOString().split('T')[0],
				checkOutDate: new Date(checkOutDate * 1000).toISOString().split('T')[0],
				numberOfNights: Math.ceil((checkOutDate - checkInDate) / 86400),
				guests: metadata.guests || 1,
				rooms: metadata.rooms || 1,
				guestWalletAddress: userAddress,
				cmsUserId: userId,
				pricePerNight: metadata.pricePerNight,
				subtotal: metadata.subtotal,
				platformFee: metadata.platformFee,
				cleaningFee: metadata.cleaningFee,
				totalAmount: totalAmount.toString(),
				currency: metadata.currency || 'GBP',
				paymentReference,
				paidAt: new Date().toISOString(),
				cmsPropertyId: metadata.cmsPropertyId,
				propertyTitle: metadata.propertyTitle,
				hostWalletAddress: metadata.hostWalletAddress,
			};

			const ipfsResult = await this.ipfsService.pinBookingMetadata(ipfsData);
			console.log(`  📌 Pinned to IPFS: ${ipfsResult.uri}`);

			// Step 3: Sign the meta-transaction
			const bookingData = {
				propertyId,
				checkInDate,
				checkOutDate,
				totalAmount: BigInt(totalAmount),
				paymentReference,
				bookingURI: ipfsResult.uri,
			};

			const signedTx = await this.custodialSigner.signPaidBookingTransaction(
				userId,
				bookingData,
				{
					forwarder: this.forwarder,
					bookingManager: this.bookingManager,
				},
				this.chainId
			);
			console.log(`  ✍️ Transaction signed`);

			// Step 4: Execute via relayer
			const metaTx = {
				from: signedTx.metaTx.from,
				to: signedTx.metaTx.to,
				value: BigInt(signedTx.metaTx.value),
				data: signedTx.metaTx.data,
				nonce: BigInt(signedTx.metaTx.nonce),
				deadline: signedTx.metaTx.deadline,
				signature: signedTx.signature,
			};

			const result = await eip712Utils.executeMetaTransaction(metaTx, this.forwarder, this.relayer);
			console.log(`  📤 Transaction submitted: ${result.transactionHash}`);
			console.log(`  ✅ Transaction confirmed in block ${result.receipt.blockNumber}`);
			const receipt = result.receipt;

			// Step 5: Get the booking ID from the event
			let bookingId = null;
			for (const log of receipt.logs) {
				try {
					const parsed = this.bookingManager.interface.parseLog({
						topics: log.topics,
						data: log.data,
					});
					if (parsed && parsed.name === 'BookingCreatedPaid') {
						bookingId = parsed.args.bookingId.toString();
						break;
					}
				} catch (e) {
					// Not a matching log, continue
				}
			}

			console.log(`  🎉 Booking created with ID: ${bookingId}`);

			return {
				success: true,
				transactionHash: receipt.hash,
				bookingId,
				ipfsUri: ipfsResult.uri,
				userAddress,
				blockNumber: receipt.blockNumber,
			};
		} catch (error) {
			console.error(`  ❌ Booking creation failed:`, error.message);
			return {
				success: false,
				error: error.message,
			};
		}
	}

	/**
	 * Create an on-chain booking with EURC payment (full escrow flow)
	 *
	 * This method:
	 * 1. Checks user's EURC balance
	 * 2. Signs and submits EURC approval transaction
	 * 3. Waits for approval confirmation
	 * 4. Pins booking metadata to IPFS
	 * 5. Signs and submits booking transaction
	 * 6. Returns booking ID and transaction hash
	 *
	 * @param {Object} params
	 * @param {number} params.userId - Strapi user ID
	 * @param {string} params.propertyId - Property ID (on-chain)
	 * @param {number} params.checkInDate - Unix timestamp
	 * @param {number} params.checkOutDate - Unix timestamp
	 * @param {string|number|BigInt} params.totalAmountEURC - Total amount in EURC (6 decimals)
	 * @param {Object} params.metadata - Additional booking metadata for IPFS
	 * @returns {Object} { success, transactionHash, bookingId, ipfsUri }
	 */
	async createEURCBooking(params) {
		const {
			userId,
			propertyId,
			checkInDate,
			checkOutDate,
			totalAmountEURC,
			metadata = {},
		} = params;

		console.log(`💶 Creating EURC booking for user ${userId}, property ${propertyId}`);

		// Validate inputs
		if (!userId || !propertyId || !checkInDate || !checkOutDate || !totalAmountEURC) {
			throw new Error('Missing required booking parameters');
		}

		if (!this.isEURCReady()) {
			throw new Error('BookingService EURC not properly initialized');
		}

		const totalAmount = BigInt(totalAmountEURC);

		try {
			// Step 1: Get user's wallet and check balance
			const userWallet = await this.custodialSigner.getUserWallet(userId);
			const userAddress = userWallet.address;
			console.log(`  👤 User wallet: ${userAddress}`);

			const balance = await this.eurcToken.balanceOf(userAddress);
			console.log(`  💰 EURC balance: ${ethers.formatUnits(balance, 6)} EURC`);

			if (balance < totalAmount) {
				throw new Error(`Insufficient EURC balance: has ${ethers.formatUnits(balance, 6)}, needs ${ethers.formatUnits(totalAmount, 6)}`);
			}

			// Step 2: Check current allowance
			const bookingManagerAddress = await this.bookingManager.getAddress();
			const currentAllowance = await this.eurcToken.allowance(userAddress, bookingManagerAddress);
			console.log(`  📝 Current allowance: ${ethers.formatUnits(currentAllowance, 6)} EURC`);

			// Step 3: Approve EURC if needed
			// Note: EURC is a standard ERC20, not ERC2771-compatible, so we must call approve directly
			// from the custodial wallet (not via meta-transaction forwarder)
			if (currentAllowance < totalAmount) {
				console.log(`  ✍️ Approving EURC for ${ethers.formatUnits(totalAmount, 6)} EURC...`);

				// Check if custodial wallet has ETH for gas
				// Actual approve tx costs ~0.0000007 ETH on Base, add buffer for gas price spikes
				const walletBalance = await this.provider.getBalance(userAddress);
				const minGasBalance = ethers.parseEther('0.000005'); // 5x buffer over typical cost

				if (walletBalance < minGasBalance) {
					// Fund the custodial wallet with just enough ETH for gas
					const fundAmount = ethers.parseEther('0.00001'); // ~10x typical cost
					console.log(`  💰 Funding custodial wallet with ${ethers.formatEther(fundAmount)} ETH for gas...`);
					const fundTx = await this.relayer.sendTransaction({
						to: userAddress,
						value: fundAmount,
					});
					await fundTx.wait();
					console.log(`  ✅ Funded custodial wallet: ${fundTx.hash}`);
				}

				// Connect user wallet to provider and call approve directly
				const userWalletConnected = userWallet.connect(this.provider);
				const eurcWithSigner = this.eurcToken.connect(userWalletConnected);

				const approveTx = await eurcWithSigner.approve(bookingManagerAddress, totalAmount);
				console.log(`  📤 Approval transaction submitted: ${approveTx.hash}`);
				await approveTx.wait();
				console.log(`  ✅ EURC approval confirmed`);

				// Verify allowance after approval
				const newAllowance = await this.eurcToken.allowance(userAddress, bookingManagerAddress);
				console.log(`  📝 New allowance after approval: ${ethers.formatUnits(newAllowance, 6)} EURC`);
			}

			// Step 4: Pin booking metadata to IPFS
			const ipfsData = {
				propertyId,
				checkInDate: new Date(checkInDate * 1000).toISOString().split('T')[0],
				checkOutDate: new Date(checkOutDate * 1000).toISOString().split('T')[0],
				numberOfNights: Math.ceil((checkOutDate - checkInDate) / 86400),
				guests: metadata.guests || 1,
				rooms: metadata.rooms || 1,
				guestWalletAddress: userAddress,
				cmsUserId: userId,
				pricePerNight: metadata.pricePerNight,
				totalAmount: ethers.formatUnits(totalAmount, 6),
				currency: 'EURC',
				paymentMethod: 'eurc_escrow',
				createdAt: new Date().toISOString(),
				cmsPropertyId: metadata.cmsPropertyId,
				propertyTitle: metadata.propertyTitle,
				hostWalletAddress: metadata.hostWalletAddress,
			};

			const ipfsResult = await this.ipfsService.pinBookingMetadata(ipfsData);
			console.log(`  📌 Pinned to IPFS: ${ipfsResult.uri}`);

			// Step 5: Sign the booking transaction
			const bookingData = {
				propertyId,
				checkInDate,
				checkOutDate,
				totalAmount,
				bookingURI: ipfsResult.uri,
			};

			console.log(`  📋 Booking data:`, JSON.stringify(bookingData, (k, v) => typeof v === 'bigint' ? v.toString() : v));

			const signedTx = await this.custodialSigner.signEURCBookingTransaction(
				userId,
				bookingData,
				{
					forwarder: this.forwarder,
					bookingManager: this.bookingManager,
				},
				this.chainId
			);
			console.log(`  ✍️ Booking transaction signed`);
			console.log(`  📋 MetaTx data length: ${signedTx.metaTx.data?.length || 0}`);

			// Step 6: Execute via relayer
			const metaTx = {
				from: signedTx.metaTx.from,
				to: signedTx.metaTx.to,
				value: BigInt(signedTx.metaTx.value),
				data: signedTx.metaTx.data,
				nonce: BigInt(signedTx.metaTx.nonce),
				deadline: signedTx.metaTx.deadline,
				signature: signedTx.signature,
			};

			// Verify allowance before simulation (helps debug timing issues)
			const preSimAllowance = await this.eurcToken.allowance(userAddress, bookingManagerAddress);
			console.log(`  📝 Pre-simulation allowance: ${ethers.formatUnits(preSimAllowance, 6)} EURC`);

			if (preSimAllowance < totalAmount) {
				// Allowance not yet reflected - wait a moment and retry
				console.log(`  ⏳ Allowance not reflected yet, waiting 2 seconds...`);
				await new Promise(resolve => setTimeout(resolve, 2000));
				const retryAllowance = await this.eurcToken.allowance(userAddress, bookingManagerAddress);
				console.log(`  📝 Retry allowance: ${ethers.formatUnits(retryAllowance, 6)} EURC`);
			}

			// Simulate first to get better error messages
			const sim = await eip712Utils.simulateMetaTransaction(metaTx, this.forwarder, this.provider);
			if (!sim.ok) {
				console.error(`  ❌ Simulation failed: ${sim.error}`);
				throw new Error(`Booking simulation failed: ${sim.error}`);
			}

			const result = await eip712Utils.executeMetaTransaction(metaTx, this.forwarder, this.relayer);
			console.log(`  📤 Booking transaction submitted: ${result.transactionHash}`);
			console.log(`  ✅ Booking confirmed in block ${result.receipt.blockNumber}`);
			const receipt = result.receipt;

			// Step 7: Get the booking ID from the event
			let bookingId = null;
			for (const log of receipt.logs) {
				try {
					const parsed = this.bookingManager.interface.parseLog({
						topics: log.topics,
						data: log.data,
					});
					if (parsed && parsed.name === 'BookingCreated') {
						bookingId = parsed.args.bookingId.toString();
						break;
					}
				} catch (e) {
					// Not a matching log, continue
				}
			}

			console.log(`  🎉 EURC Booking created with ID: ${bookingId}`);
			console.log(`  💶 ${ethers.formatUnits(totalAmount, 6)} EURC now in escrow`);

			return {
				success: true,
				transactionHash: receipt.hash,
				bookingId,
				ipfsUri: ipfsResult.uri,
				userAddress,
				blockNumber: receipt.blockNumber,
				escrowAmount: ethers.formatUnits(totalAmount, 6),
			};
		} catch (error) {
			console.error(`  ❌ EURC Booking creation failed:`, error.message);
			return {
				success: false,
				error: error.message,
			};
		}
	}

	/**
	 * Get user's EURC balance
	 * @param {number} userId - Strapi user ID
	 * @returns {Object} { balance, formatted }
	 */
	async getUserEURCBalance(userId) {
		if (!this.eurcToken) {
			throw new Error('EURC token not configured');
		}

		const userWallet = await this.custodialSigner.getUserWallet(userId);
		const balance = await this.eurcToken.balanceOf(userWallet.address);

		return {
			balance: balance.toString(),
			formatted: ethers.formatUnits(balance, 6),
			address: userWallet.address,
		};
	}

	/**
	 * Get the status of the booking service
	 * @returns {Object} Status information
	 */
	getStatus() {
		return {
			isReady: this.isReady(),
			isEURCReady: this.isEURCReady(),
			custodialSignerAvailable: this.custodialSigner.isAvailable(),
			ipfsServiceAvailable: this.ipfsService.isAvailable(),
			hasRelayer: !!this.relayer,
			hasEURCToken: !!this.eurcToken,
			chainId: this.chainId,
		};
	}
}

module.exports = BookingService;
