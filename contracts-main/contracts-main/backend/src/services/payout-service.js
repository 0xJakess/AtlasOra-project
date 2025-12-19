const { ethers } = require('ethers');
const CustodialSigner = require('./custodial-signer');

// Standard ERC-20 ABI for EURC transfers
const ERC20_ABI = [
	'function transfer(address to, uint256 amount) returns (bool)',
	'function balanceOf(address account) view returns (uint256)',
	'function decimals() view returns (uint8)',
];

/**
 * PayoutService - Handles host payouts from custodial wallets to CDP wallets
 *
 * When a booking is completed, the BookingManager contract sends EURC to the host's
 * custodial wallet (the property owner address). This service monitors for those
 * payouts and automatically transfers the EURC to the host's CDP wallet if configured.
 *
 * Flow:
 * 1. BookingCompleted event triggers -> EURC sent to host's custodial wallet
 * 2. This service detects the payout
 * 3. If host has CDP wallet and payoutPreference = "cdp_wallet":
 *    - Transfer EURC from custodial wallet to CDP wallet
 * 4. If payoutPreference = "custodial" or no CDP wallet:
 *    - Leave EURC in custodial wallet (host can withdraw later)
 */
class PayoutService {
	constructor(config = {}) {
		this.custodialSigner = new CustodialSigner(config);

		// Strapi configuration
		this.strapiBaseUrl = config.strapiBaseUrl || process.env.STRAPI_BASE_URL || 'http://localhost:1337';
		this.strapiToken = config.strapiToken || process.env.STRAPI_API_TOKEN;

		// Blockchain connections (set by initialize())
		this.provider = null;
		this.relayer = null;
		this.eurcToken = null;
		this.chainId = null;

		// Track pending payouts to prevent duplicates
		this.pendingPayouts = new Set();
	}

	/**
	 * Initialize with blockchain connections
	 */
	initialize(blockchainConfig) {
		this.provider = blockchainConfig.provider;
		this.relayer = blockchainConfig.relayer;
		this.chainId = blockchainConfig.chainId;

		// Create EURC token contract instance
		const eurcAddress = process.env.EURC_TOKEN_ADDRESS;
		if (eurcAddress) {
			this.eurcToken = new ethers.Contract(eurcAddress, ERC20_ABI, this.provider);
		}

		console.log('✅ PayoutService initialized');
	}

	/**
	 * Check if service is ready
	 */
	isReady() {
		return !!(this.provider && this.relayer && this.eurcToken && this.chainId);
	}

	/**
	 * Get user details from CMS including payout preferences
	 * @param {number} userId - Strapi user ID
	 * @returns {Object|null} User data
	 */
	async getUserFromCMS(userId) {
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

			return await response.json();
		} catch (error) {
			console.error(`  ⚠️ Failed to get user from CMS:`, error.message);
			return null;
		}
	}

	/**
	 * Update booking payout status in CMS
	 * @param {string} bookingId - Blockchain booking ID
	 * @param {Object} payoutData - Payout data to update
	 */
	async updateBookingPayoutStatus(bookingId, payoutData) {
		try {
			// Find booking by blockchain booking ID
			const searchUrl = `${this.strapiBaseUrl}/api/proeprty-bookings?filters[blockchainBookingId][$eq]=${bookingId}`;
			const headers = {
				'Content-Type': 'application/json',
			};
			if (this.strapiToken) {
				headers['Authorization'] = `Bearer ${this.strapiToken}`;
			}

			const searchResponse = await fetch(searchUrl, { headers });
			if (!searchResponse.ok) {
				console.log(`  ⚠️ Failed to search for booking ${bookingId}`);
				return;
			}

			const searchResult = await searchResponse.json();
			const bookings = searchResult.data || [];

			if (bookings.length === 0) {
				console.log(`  ⚠️ Booking ${bookingId} not found in CMS`);
				return;
			}

			const booking = bookings[0];
			const bookingDocId = booking.documentId || booking.id;

			// Update booking with payout data
			const updateUrl = `${this.strapiBaseUrl}/api/proeprty-bookings/${bookingDocId}`;
			const updateResponse = await fetch(updateUrl, {
				method: 'PUT',
				headers,
				body: JSON.stringify({ data: payoutData }),
			});

			if (updateResponse.ok) {
				console.log(`  📝 Updated booking ${bookingId} payout status: ${payoutData.payoutStatus}`);
			} else {
				const errorText = await updateResponse.text();
				console.log(`  ⚠️ Failed to update booking payout status: ${errorText}`);
			}
		} catch (error) {
			console.error(`  ⚠️ Error updating booking payout status:`, error.message);
		}
	}

	/**
	 * Get user by wallet address from CMS
	 * @param {string} walletAddress - Host's custodial wallet address
	 * @returns {Object|null} User data
	 */
	async getUserByWalletAddress(walletAddress) {
		try {
			const url = `${this.strapiBaseUrl}/api/users?filters[walletAddress][$eqi]=${walletAddress.toLowerCase()}`;
			const headers = {};
			if (this.strapiToken) {
				headers['Authorization'] = `Bearer ${this.strapiToken}`;
			}

			const response = await fetch(url, { headers });
			if (!response.ok) {
				return null;
			}

			const users = await response.json();
			return users.length > 0 ? users[0] : null;
		} catch (error) {
			console.error(`  ⚠️ Failed to get user by wallet:`, error.message);
			return null;
		}
	}

	/**
	 * Process a host payout - transfer EURC from custodial wallet to CDP wallet
	 *
	 * @param {Object} params
	 * @param {number} params.hostUserId - Host's Strapi user ID
	 * @param {string} params.bookingId - Booking ID for tracking
	 * @param {string|BigInt} params.amount - Amount in EURC (6 decimals)
	 * @returns {Object} { success, txHash, error }
	 */
	async processHostPayout(params) {
		const { hostUserId, bookingId, amount } = params;
		const payoutKey = `${hostUserId}-${bookingId}`;

		// Prevent duplicate processing
		if (this.pendingPayouts.has(payoutKey)) {
			console.log(`  ⏳ Payout ${payoutKey} already in progress`);
			return { success: false, error: 'Payout already in progress' };
		}

		if (!this.isReady()) {
			return { success: false, error: 'PayoutService not initialized' };
		}

		this.pendingPayouts.add(payoutKey);

		try {
			console.log(`💸 Processing payout for host ${hostUserId}, booking ${bookingId}`);

			// Get host details from CMS
			const host = await this.getUserFromCMS(hostUserId);
			if (!host) {
				return { success: false, error: 'Host not found' };
			}

			// Check payout preference
			const payoutPreference = host.payoutPreference || 'custodial';
			const cdpWalletAddress = host.cdpWalletAddress;

			console.log(`  📋 Payout preference: ${payoutPreference}`);
			console.log(`  📋 CDP wallet: ${cdpWalletAddress || 'not configured'}`);

			// If payout preference is custodial or no CDP wallet, do nothing
			if (payoutPreference !== 'cdp_wallet' || !cdpWalletAddress) {
				console.log(`  ✅ Payout stays in custodial wallet (preference: ${payoutPreference})`);

				// Update CMS booking with skipped status
				await this.updateBookingPayoutStatus(bookingId, {
					payoutStatus: 'skipped',
					payoutAmount: parseFloat(ethers.formatUnits(BigInt(amount), 6)),
					payoutDate: new Date().toISOString(),
				});

				return {
					success: true,
					skipped: true,
					reason: payoutPreference !== 'cdp_wallet'
						? 'Payout preference is not CDP wallet'
						: 'No CDP wallet configured',
				};
			}

			// Get host's custodial wallet
			const custodialWallet = await this.custodialSigner.getUserWallet(hostUserId);
			const custodialAddress = custodialWallet.address;
			console.log(`  🔑 Custodial wallet: ${custodialAddress}`);

			// Check EURC balance
			const balance = await this.eurcToken.balanceOf(custodialAddress);
			const amountBigInt = BigInt(amount);

			console.log(`  💰 Custodial balance: ${ethers.formatUnits(balance, 6)} EURC`);
			console.log(`  💶 Amount to transfer: ${ethers.formatUnits(amountBigInt, 6)} EURC`);

			if (balance < amountBigInt) {
				console.warn(`  ⚠️ Insufficient balance for payout`);
				return {
					success: false,
					error: `Insufficient balance: has ${ethers.formatUnits(balance, 6)}, needs ${ethers.formatUnits(amountBigInt, 6)}`,
				};
			}

			// Fund custodial wallet with ETH for gas if needed
			const ethBalance = await this.provider.getBalance(custodialAddress);
			const minGasBalance = ethers.parseEther('0.000005');

			if (ethBalance < minGasBalance) {
				const fundAmount = ethers.parseEther('0.00001');
				console.log(`  💰 Funding custodial wallet with ${ethers.formatEther(fundAmount)} ETH for gas...`);
				const fundTx = await this.relayer.sendTransaction({
					to: custodialAddress,
					value: fundAmount,
				});
				await fundTx.wait();
				console.log(`  ✅ Funded: ${fundTx.hash}`);
			}

			// Transfer EURC from custodial wallet to CDP wallet
			const walletConnected = custodialWallet.connect(this.provider);
			const eurcWithSigner = this.eurcToken.connect(walletConnected);

			console.log(`  📤 Transferring ${ethers.formatUnits(amountBigInt, 6)} EURC to CDP wallet...`);
			const tx = await eurcWithSigner.transfer(cdpWalletAddress, amountBigInt);
			console.log(`  📤 Transaction submitted: ${tx.hash}`);

			const receipt = await tx.wait();
			console.log(`  ✅ Transfer confirmed in block ${receipt.blockNumber}`);

			// Update CMS booking with completed status
			await this.updateBookingPayoutStatus(bookingId, {
				payoutStatus: 'completed',
				payoutTxHash: receipt.hash,
				payoutAmount: parseFloat(ethers.formatUnits(amountBigInt, 6)),
				payoutDate: new Date().toISOString(),
				payoutDestination: cdpWalletAddress,
			});

			return {
				success: true,
				txHash: receipt.hash,
				from: custodialAddress,
				to: cdpWalletAddress,
				amount: ethers.formatUnits(amountBigInt, 6),
			};
		} catch (error) {
			console.error(`  ❌ Payout failed:`, error.message);

			// Update CMS booking with failed status
			await this.updateBookingPayoutStatus(bookingId, {
				payoutStatus: 'failed',
			});

			return { success: false, error: error.message };
		} finally {
			this.pendingPayouts.delete(payoutKey);
		}
	}

	/**
	 * Process a payout by host wallet address (for event-driven processing)
	 *
	 * @param {string} hostWalletAddress - Host's custodial wallet address
	 * @param {string} bookingId - Booking ID
	 * @param {string|BigInt} amount - Amount in EURC
	 * @returns {Object} { success, txHash, error }
	 */
	async processPayoutByAddress(hostWalletAddress, bookingId, amount) {
		// Look up host by wallet address
		const host = await this.getUserByWalletAddress(hostWalletAddress);
		if (!host) {
			console.log(`  ⚠️ No host found for wallet ${hostWalletAddress}`);
			return { success: false, error: 'Host not found by wallet address' };
		}

		return this.processHostPayout({
			hostUserId: host.id,
			bookingId,
			amount,
		});
	}

	/**
	 * Manually trigger payout for a specific user (for testing or manual processing)
	 *
	 * @param {number} userId - Host's Strapi user ID
	 * @param {string|BigInt} amount - Amount in EURC (6 decimals), or 'all' for full balance
	 * @returns {Object} { success, txHash, error }
	 */
	async manualPayout(userId, amount = 'all') {
		if (!this.isReady()) {
			return { success: false, error: 'PayoutService not initialized' };
		}

		try {
			console.log(`💸 Manual payout for user ${userId}`);

			// Get host details
			const host = await this.getUserFromCMS(userId);
			if (!host) {
				return { success: false, error: 'User not found' };
			}

			const cdpWalletAddress = host.cdpWalletAddress;
			if (!cdpWalletAddress) {
				return { success: false, error: 'No CDP wallet configured for user' };
			}

			// Get custodial wallet
			const custodialWallet = await this.custodialSigner.getUserWallet(userId);
			const custodialAddress = custodialWallet.address;

			// Get balance
			const balance = await this.eurcToken.balanceOf(custodialAddress);

			// Determine amount to transfer
			let transferAmount;
			if (amount === 'all') {
				transferAmount = balance;
			} else {
				transferAmount = BigInt(amount);
			}

			if (transferAmount === 0n) {
				return { success: false, error: 'No EURC balance to transfer' };
			}

			if (balance < transferAmount) {
				return {
					success: false,
					error: `Insufficient balance: has ${ethers.formatUnits(balance, 6)}, requested ${ethers.formatUnits(transferAmount, 6)}`,
				};
			}

			console.log(`  📋 From: ${custodialAddress}`);
			console.log(`  📋 To: ${cdpWalletAddress}`);
			console.log(`  📋 Amount: ${ethers.formatUnits(transferAmount, 6)} EURC`);

			// Fund with ETH if needed
			const ethBalance = await this.provider.getBalance(custodialAddress);
			const minGasBalance = ethers.parseEther('0.000005');

			if (ethBalance < minGasBalance) {
				const fundAmount = ethers.parseEther('0.00001');
				console.log(`  💰 Funding with ${ethers.formatEther(fundAmount)} ETH for gas...`);
				const fundTx = await this.relayer.sendTransaction({
					to: custodialAddress,
					value: fundAmount,
				});
				await fundTx.wait();
			}

			// Execute transfer
			const walletConnected = custodialWallet.connect(this.provider);
			const eurcWithSigner = this.eurcToken.connect(walletConnected);

			const tx = await eurcWithSigner.transfer(cdpWalletAddress, transferAmount);
			console.log(`  📤 Transaction: ${tx.hash}`);

			const receipt = await tx.wait();
			console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);

			return {
				success: true,
				txHash: receipt.hash,
				from: custodialAddress,
				to: cdpWalletAddress,
				amount: ethers.formatUnits(transferAmount, 6),
			};
		} catch (error) {
			console.error(`  ❌ Manual payout failed:`, error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get payout status for a user
	 * @param {number} userId - Strapi user ID
	 * @returns {Object} Payout status info
	 */
	async getPayoutStatus(userId) {
		try {
			const host = await this.getUserFromCMS(userId);
			if (!host) {
				return { success: false, error: 'User not found' };
			}

			const custodialWallet = await this.custodialSigner.getUserWallet(userId);
			const balance = await this.eurcToken.balanceOf(custodialWallet.address);

			return {
				success: true,
				userId,
				custodialWallet: custodialWallet.address,
				cdpWallet: host.cdpWalletAddress || null,
				payoutPreference: host.payoutPreference || 'custodial',
				pendingBalance: ethers.formatUnits(balance, 6),
				canAutoPayout: host.payoutPreference === 'cdp_wallet' && !!host.cdpWalletAddress,
			};
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get service status
	 */
	getStatus() {
		return {
			isReady: this.isReady(),
			pendingPayouts: this.pendingPayouts.size,
			hasEURC: !!this.eurcToken,
			chainId: this.chainId,
		};
	}
}

module.exports = PayoutService;
