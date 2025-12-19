const { Coinbase, Wallet, Webhook } = require('@coinbase/coinbase-sdk');
const fs = require('fs');
const path = require('path');

/**
 * CDPWalletService - Manages Coinbase CDP wallets for host payouts
 *
 * This service handles:
 * - Creating CDP wallets for hosts
 * - Checking EURC balances
 * - Gasless EURC transfers
 * - Webhook setup for incoming transfers
 *
 * CDP wallets provide hosts with a seamless way to receive EURC payments
 * from escrow, with the option to off-ramp to traditional banking via Coinbase.
 */
class CDPWalletService {
	constructor(config = {}) {
		this.apiKeyPath = config.apiKeyPath || process.env.CDP_API_KEY_PATH;
		this.apiKeyName = config.apiKeyName || process.env.CDP_API_KEY_NAME;
		this.apiKeyPrivateKey = config.apiKeyPrivateKey || process.env.CDP_API_KEY_PRIVATE_KEY;
		this.network = config.network || process.env.CDP_NETWORK || 'base-sepolia';
		this.webhookUrl = config.webhookUrl || process.env.CDP_WEBHOOK_URL;

		this.isConfigured = false;
		this.walletCache = new Map(); // userId -> wallet (in production, use Redis)

		// Strapi configuration for storing wallet info
		this.strapiBaseUrl = config.strapiBaseUrl || process.env.STRAPI_BASE_URL || 'http://localhost:1337';
		this.strapiToken = config.strapiToken || process.env.STRAPI_API_TOKEN;
	}

	/**
	 * Initialize the CDP SDK
	 * Must be called before using any other methods
	 */
	async initialize() {
		try {
			// Configure CDP SDK - prefer direct env vars, then JSON file
			if (this.apiKeyName && this.apiKeyPrivateKey) {
				Coinbase.configure({
					apiKeyName: this.apiKeyName,
					privateKey: this.apiKeyPrivateKey,
				});
				console.log('✅ CDP SDK configured from environment variables');
			} else if (this.apiKeyPath && fs.existsSync(this.apiKeyPath)) {
				Coinbase.configureFromJson({ filePath: this.apiKeyPath });
				console.log('✅ CDP SDK configured from JSON file');
			} else {
				console.warn('⚠️ CDP SDK not configured - set CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY');
				return false;
			}

			this.isConfigured = true;

			// Log network
			const networkId = this.getNetworkId();
			console.log(`   Network: ${this.network}`);

			return true;
		} catch (error) {
			console.error('❌ Failed to initialize CDP SDK:', error.message);
			return false;
		}
	}

	/**
	 * Get the Coinbase network ID
	 */
	getNetworkId() {
		switch (this.network) {
			case 'base-mainnet':
				return Coinbase.networks.BaseMainnet;
			case 'base-sepolia':
				return Coinbase.networks.BaseSepolia;
			case 'ethereum-mainnet':
				return Coinbase.networks.EthereumMainnet;
			case 'ethereum-sepolia':
				return Coinbase.networks.EthereumSepolia;
			default:
				return Coinbase.networks.BaseSepolia;
		}
	}

	/**
	 * Create a new CDP wallet for a host
	 * @param {number} userId - Strapi user ID
	 * @param {Object} options - Additional options
	 * @returns {Object} { success, walletId, address, error }
	 */
	async createHostWallet(userId, options = {}) {
		if (!this.isConfigured) {
			return { success: false, error: 'CDP SDK not configured' };
		}

		try {
			console.log(`🔐 Creating CDP wallet for user ${userId}...`);

			// Check if user already has a CDP wallet
			const existingWallet = await this.getHostWalletFromCMS(userId);
			if (existingWallet && existingWallet.cdpWalletAddress) {
				console.log(`   User ${userId} already has CDP wallet: ${existingWallet.cdpWalletAddress}`);
				return {
					success: true,
					walletId: existingWallet.cdpWalletId,
					address: existingWallet.cdpWalletAddress,
					existing: true,
				};
			}

			// Create new wallet
			const wallet = await Wallet.create({
				networkId: this.getNetworkId(),
			});

			const address = await wallet.getDefaultAddress();
			const walletId = wallet.getId();
			const walletAddress = address.getId();

			console.log(`   ✅ Wallet created: ${walletAddress}`);

			// Save wallet data to file for persistence (CDP requires this)
			await this.persistWallet(userId, wallet);

			// Save to CMS
			await this.saveWalletToCMS(userId, walletId, walletAddress);

			// Cache wallet
			this.walletCache.set(userId, wallet);

			return {
				success: true,
				walletId,
				address: walletAddress,
				existing: false,
			};
		} catch (error) {
			console.error(`❌ Failed to create CDP wallet for user ${userId}:`, error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Persist wallet data to file (required by CDP SDK for wallet recovery)
	 * @param {number} userId - User ID
	 * @param {Wallet} wallet - CDP Wallet instance
	 */
	async persistWallet(userId, wallet) {
		try {
			const walletsDir = path.join(process.cwd(), 'data', 'cdp-wallets');
			if (!fs.existsSync(walletsDir)) {
				fs.mkdirSync(walletsDir, { recursive: true });
			}

			const walletPath = path.join(walletsDir, `wallet-${userId}.json`);

			// Export wallet data
			const walletData = wallet.export();
			fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));

			console.log(`   💾 Wallet persisted to ${walletPath}`);
		} catch (error) {
			console.error(`   ⚠️ Failed to persist wallet:`, error.message);
			// Non-fatal - wallet can still be used
		}
	}

	/**
	 * Load a persisted wallet from file
	 * @param {number} userId - User ID
	 * @returns {Wallet|null} Wallet instance or null
	 */
	async loadPersistedWallet(userId) {
		try {
			const walletPath = path.join(process.cwd(), 'data', 'cdp-wallets', `wallet-${userId}.json`);

			if (!fs.existsSync(walletPath)) {
				return null;
			}

			const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
			const wallet = await Wallet.import(walletData);

			return wallet;
		} catch (error) {
			console.error(`   ⚠️ Failed to load persisted wallet:`, error.message);
			return null;
		}
	}

	/**
	 * Get host wallet from CMS
	 * @param {number} userId - Strapi user ID
	 * @returns {Object|null} { cdpWalletId, cdpWalletAddress } or null
	 */
	async getHostWalletFromCMS(userId) {
		try {
			const url = `${this.strapiBaseUrl}/api/users/${userId}`;
			const headers = {};
			if (this.strapiToken) {
				headers['Authorization'] = `Bearer ${this.strapiToken}`;
			}

			const response = await fetch(url, { headers });
			if (!response.ok) {
				return null;
			}

			const user = await response.json();
			if (user.cdpWalletId && user.cdpWalletAddress) {
				return {
					cdpWalletId: user.cdpWalletId,
					cdpWalletAddress: user.cdpWalletAddress,
				};
			}

			return null;
		} catch (error) {
			console.error(`   ⚠️ Failed to get wallet from CMS:`, error.message);
			return null;
		}
	}

	/**
	 * Save wallet info to CMS
	 * @param {number} userId - Strapi user ID
	 * @param {string} walletId - CDP wallet ID
	 * @param {string} walletAddress - Wallet address
	 */
	async saveWalletToCMS(userId, walletId, walletAddress) {
		try {
			const url = `${this.strapiBaseUrl}/api/users/${userId}`;
			const headers = {
				'Content-Type': 'application/json',
			};
			if (this.strapiToken) {
				headers['Authorization'] = `Bearer ${this.strapiToken}`;
			}

			const response = await fetch(url, {
				method: 'PUT',
				headers,
				body: JSON.stringify({
					cdpWalletId: walletId,
					cdpWalletAddress: walletAddress,
				}),
			});

			if (!response.ok) {
				console.warn(`   ⚠️ Failed to save wallet to CMS: HTTP ${response.status}`);
			} else {
				console.log(`   💾 Wallet saved to CMS for user ${userId}`);
			}
		} catch (error) {
			console.error(`   ⚠️ Failed to save wallet to CMS:`, error.message);
		}
	}

	/**
	 * Get host wallet details including balance
	 * @param {number} userId - Strapi user ID
	 * @returns {Object} { success, walletId, address, balances, error }
	 */
	async getHostWallet(userId) {
		if (!this.isConfigured) {
			return { success: false, error: 'CDP SDK not configured' };
		}

		try {
			// Check cache first
			let wallet = this.walletCache.get(userId);

			// Try to load from file if not in cache
			if (!wallet) {
				wallet = await this.loadPersistedWallet(userId);
				if (wallet) {
					this.walletCache.set(userId, wallet);
				}
			}

			// Get wallet info from CMS if no local wallet
			if (!wallet) {
				const cmsWallet = await this.getHostWalletFromCMS(userId);
				if (!cmsWallet) {
					return { success: false, error: 'Wallet not found' };
				}

				return {
					success: true,
					walletId: cmsWallet.cdpWalletId,
					address: cmsWallet.cdpWalletAddress,
					balances: null, // Can't get balances without wallet instance
					note: 'Wallet exists but not loaded - balances unavailable',
				};
			}

			// Get balances
			const address = await wallet.getDefaultAddress();
			const balances = await wallet.listBalances();

			// Format balances
			const formattedBalances = {};
			for (const [asset, balance] of Object.entries(balances)) {
				formattedBalances[asset] = balance.toString();
			}

			return {
				success: true,
				walletId: wallet.getId(),
				address: address.getId(),
				balances: formattedBalances,
			};
		} catch (error) {
			console.error(`❌ Failed to get wallet for user ${userId}:`, error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get EURC balance for an address
	 * @param {string} address - Wallet address
	 * @returns {Object} { success, balance, formatted, error }
	 */
	async getEURCBalance(address) {
		if (!this.isConfigured) {
			return { success: false, error: 'CDP SDK not configured' };
		}

		try {
			// For now, we'll use the wallet's listBalances method
			// This requires having the wallet instance
			// TODO: Implement direct balance check via RPC for external addresses

			return {
				success: true,
				balance: '0',
				formatted: '0.00',
				note: 'Use getHostWallet() for full balance info',
			};
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Transfer EURC (gasless) from a wallet
	 * @param {number} fromUserId - Source user ID
	 * @param {string} toAddress - Destination address
	 * @param {number|string} amount - Amount in EURC
	 * @returns {Object} { success, transferId, txHash, error }
	 */
	async transferEURC(fromUserId, toAddress, amount) {
		if (!this.isConfigured) {
			return { success: false, error: 'CDP SDK not configured' };
		}

		try {
			console.log(`💶 Transferring ${amount} EURC to ${toAddress}...`);

			// Load wallet
			let wallet = this.walletCache.get(fromUserId);
			if (!wallet) {
				wallet = await this.loadPersistedWallet(fromUserId);
				if (!wallet) {
					return { success: false, error: 'Wallet not found' };
				}
				this.walletCache.set(fromUserId, wallet);
			}

			// Create gasless transfer
			let transfer = await wallet.createTransfer({
				amount: parseFloat(amount),
				assetId: 'eurc',
				destination: toAddress,
				gasless: true, // Coinbase pays gas fees
			});

			// Wait for transfer to complete
			transfer = await transfer.wait();

			const txHash = transfer.getTransactionHash();
			console.log(`   ✅ Transfer complete: ${txHash}`);

			return {
				success: true,
				transferId: transfer.getId(),
				txHash,
				status: transfer.getStatus(),
			};
		} catch (error) {
			console.error(`❌ EURC transfer failed:`, error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Set up webhook for incoming ERC-20 transfers to an address
	 * @param {string} address - Address to monitor
	 * @param {string} callbackUrl - Webhook endpoint (optional, uses default)
	 * @returns {Object} { success, webhookId, error }
	 */
	async setupTransferWebhook(address, callbackUrl = null) {
		if (!this.isConfigured) {
			return { success: false, error: 'CDP SDK not configured' };
		}

		const notificationUrl = callbackUrl || this.webhookUrl;
		if (!notificationUrl) {
			return { success: false, error: 'No webhook URL configured' };
		}

		try {
			console.log(`🔔 Setting up webhook for ${address}...`);

			const webhook = await Webhook.create({
				networkId: this.getNetworkId(),
				notificationUri: notificationUrl,
				eventType: 'erc20_transfer',
				eventTypeFilter: {
					addresses: [address],
				},
			});

			console.log(`   ✅ Webhook created: ${webhook.getId()}`);

			return {
				success: true,
				webhookId: webhook.getId(),
			};
		} catch (error) {
			console.error(`❌ Failed to create webhook:`, error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Verify webhook signature (for incoming webhook requests)
	 * @param {Object} payload - Webhook payload
	 * @param {string} signature - Signature header
	 * @returns {boolean} Whether signature is valid
	 */
	verifyWebhookSignature(payload, signature) {
		// TODO: Implement signature verification
		// For now, return true (should implement proper verification in production)
		return true;
	}

	/**
	 * Process incoming webhook event
	 * @param {Object} event - Webhook event payload
	 * @returns {Object} Processed event data
	 */
	async processWebhookEvent(event) {
		console.log(`📥 Processing CDP webhook event: ${event.eventType}`);

		switch (event.eventType) {
			case 'erc20_transfer':
				return this.handleERC20Transfer(event);
			default:
				console.log(`   Unknown event type: ${event.eventType}`);
				return { handled: false };
		}
	}

	/**
	 * Handle ERC-20 transfer event
	 * @param {Object} event - Transfer event
	 */
	async handleERC20Transfer(event) {
		const { from, to, value, contractAddress, transactionHash } = event.data || {};

		console.log(`   💶 ERC-20 Transfer detected:`);
		console.log(`      From: ${from}`);
		console.log(`      To: ${to}`);
		console.log(`      Amount: ${value}`);
		console.log(`      Token: ${contractAddress}`);
		console.log(`      Tx: ${transactionHash}`);

		// TODO: Update booking payout status in CMS
		// TODO: Notify host of incoming payment

		return {
			handled: true,
			type: 'erc20_transfer',
			data: { from, to, value, contractAddress, transactionHash },
		};
	}

	/**
	 * Check if service is ready
	 * @returns {boolean}
	 */
	isReady() {
		return this.isConfigured;
	}

	/**
	 * Get service status
	 * @returns {Object}
	 */
	getStatus() {
		return {
			configured: this.isConfigured,
			network: this.network,
			webhookUrl: this.webhookUrl || 'not configured',
			cachedWallets: this.walletCache.size,
		};
	}
}

module.exports = CDPWalletService;
