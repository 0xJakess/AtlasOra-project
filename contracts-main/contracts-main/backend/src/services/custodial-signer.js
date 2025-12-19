const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * CustodialSigner - Service for signing transactions on behalf of users with custodial wallets
 *
 * This service generates deterministic HD wallets for users using the master mnemonic
 * and signs meta-transactions for users who have custodial wallets.
 *
 * Wallets are derived using BIP-44 path: m/44'/60'/0'/0/{userId}
 * This means we can regenerate any user's wallet on-demand without storing private keys.
 */
class CustodialSigner {
	constructor(config = {}) {
		this.strapiBaseUrl = config.strapiBaseUrl || process.env.STRAPI_BASE_URL || 'http://localhost:1337';
		this.strapiToken = config.strapiToken || process.env.STRAPI_API_TOKEN;
		this.masterMnemonic = config.masterMnemonic || process.env.WALLET_MASTER_MNEMONIC;
		this.encryptionKey = config.encryptionKey || process.env.WALLET_ENCRYPTION_KEY;

		if (!this.masterMnemonic) {
			console.warn('⚠️ CustodialSigner: WALLET_MASTER_MNEMONIC not set. Custodial signing will be unavailable.');
		}
	}

	/**
	 * Derive a wallet for a user using HD derivation
	 * @param {number} userId - The user ID to derive wallet for
	 * @returns {ethers.Wallet} The derived wallet
	 */
	deriveUserWallet(userId) {
		if (!this.masterMnemonic) {
			throw new Error('WALLET_MASTER_MNEMONIC not configured');
		}

		const mnemonic = ethers.Mnemonic.fromPhrase(this.masterMnemonic);
		const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${userId}`);

		return new ethers.Wallet(wallet.privateKey);
	}

	/**
	 * Decrypt a private key that was encrypted with AES-256-GCM (legacy method)
	 * @param {Object} encryptedObj - The encrypted private key object { iv, encryptedData, authTag }
	 * @returns {string} The decrypted private key
	 */
	decryptPrivateKey(encryptedObj) {
		if (!this.encryptionKey) {
			throw new Error('WALLET_ENCRYPTION_KEY not configured');
		}

		const key = Buffer.from(this.encryptionKey, 'hex');
		if (key.length !== 32) {
			throw new Error('WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
		}

		const decipher = crypto.createDecipheriv(
			'aes-256-gcm',
			key,
			Buffer.from(encryptedObj.iv, 'hex')
		);

		decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));

		let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	}

	/**
	 * Get a user's wallet instance by their CMS user ID
	 * Uses HD derivation to regenerate the wallet on-demand
	 * @param {number} userId - The Strapi user ID
	 * @returns {ethers.Wallet} An ethers Wallet instance
	 */
	async getUserWallet(userId) {
		// Fetch user from Strapi to verify they exist and get their wallet address
		const url = `${this.strapiBaseUrl}/api/users/${userId}`;
		const headers = {};
		if (this.strapiToken) {
			headers['Authorization'] = `Bearer ${this.strapiToken}`;
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			throw new Error(`User ${userId} not found (HTTP ${response.status})`);
		}

		const user = await response.json();

		// Derive wallet using HD derivation (no need to store/retrieve encrypted keys)
		const wallet = this.deriveUserWallet(userId);

		if (!user.walletAddress) {
			// Auto-save the derived wallet address to Strapi
			console.log(`  💾 Saving derived wallet address for user ${userId}: ${wallet.address}`);
			try {
				const updateResponse = await fetch(url, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						...(this.strapiToken ? { 'Authorization': `Bearer ${this.strapiToken}` } : {}),
					},
					body: JSON.stringify({ walletAddress: wallet.address }),
				});
				if (!updateResponse.ok) {
					console.warn(`  ⚠️ Failed to save wallet address for user ${userId}`);
				}
			} catch (err) {
				console.warn(`  ⚠️ Failed to save wallet address: ${err.message}`);
			}
		} else {
			// Verify the derived address matches what's stored in Strapi
			if (wallet.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
				throw new Error(`Wallet address mismatch for user ${userId}: derived ${wallet.address} vs stored ${user.walletAddress}`);
			}
		}

		return wallet;
	}

	/**
	 * Get a user by their wallet address
	 * @param {string} walletAddress - The wallet address
	 * @returns {Object} User data from Strapi
	 */
	async getUserByWalletAddress(walletAddress) {
		const url = `${this.strapiBaseUrl}/api/users?filters[walletAddress][$eqi]=${walletAddress.toLowerCase()}`;
		const headers = {};
		if (this.strapiToken) {
			headers['Authorization'] = `Bearer ${this.strapiToken}`;
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			throw new Error(`Failed to fetch user by wallet address (HTTP ${response.status})`);
		}

		const users = await response.json();

		if (!Array.isArray(users) || users.length === 0) {
			throw new Error(`No user found with wallet address ${walletAddress}`);
		}

		return users[0];
	}

	/**
	 * Sign a meta-transaction for a paid booking (fiat or crypto)
	 * @param {number} userId - The Strapi user ID
	 * @param {Object} bookingData - Booking data
	 * @param {Object} contracts - Contract instances { forwarder, bookingManager }
	 * @param {number} chainId - The chain ID
	 * @returns {Object} The signed meta-transaction { metaTx, signature, userAddress }
	 */
	async signPaidBookingTransaction(userId, bookingData, contracts, chainId) {
		const { forwarder, bookingManager } = contracts;

		// Get user's wallet
		const wallet = await this.getUserWallet(userId);
		const userAddress = wallet.address;

		// Get nonce
		const nonce = await forwarder.getNonce(userAddress);

		// Build deadline (1 hour from now)
		const deadline = Math.floor(Date.now() / 1000) + 3600;

		// Encode the function call
		const data = bookingManager.interface.encodeFunctionData(
			'createBookingPaid',
			[
				bookingData.propertyId,
				bookingData.checkInDate,
				bookingData.checkOutDate,
				bookingData.totalAmount,
				bookingData.paymentReference,
				bookingData.bookingURI,
			]
		);

		// Build the meta-transaction
		const metaTx = {
			from: userAddress,
			to: await bookingManager.getAddress(),
			value: 0n, // No payment for fiat bookings
			data,
			nonce,
			deadline,
		};

		// Build EIP-712 typed data
		const domain = {
			name: 'PropertyRental',
			version: '1',
			chainId,
			verifyingContract: await forwarder.getAddress(),
		};

		const types = {
			MetaTransaction: [
				{ name: 'from', type: 'address' },
				{ name: 'to', type: 'address' },
				{ name: 'value', type: 'uint256' },
				{ name: 'data', type: 'bytes' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		};

		const message = {
			from: metaTx.from,
			to: metaTx.to,
			value: metaTx.value,
			data: metaTx.data,
			nonce: metaTx.nonce,
			deadline: metaTx.deadline,
		};

		// Sign the typed data with the user's custodial wallet
		const signature = await wallet.signTypedData(domain, types, message);

		return {
			metaTx: {
				from: metaTx.from,
				to: metaTx.to,
				value: metaTx.value.toString(),
				data: metaTx.data,
				nonce: metaTx.nonce.toString(),
				deadline: metaTx.deadline,
				signature,
			},
			signature,
			userAddress,
		};
	}

	/**
	 * Sign a meta-transaction for EURC token approval
	 * @param {number} userId - The Strapi user ID
	 * @param {string} spender - The address to approve (BookingManager)
	 * @param {BigInt} amount - The amount to approve
	 * @param {Object} contracts - Contract instances { forwarder, eurcToken }
	 * @param {number} chainId - The chain ID
	 * @returns {Object} The signed meta-transaction
	 */
	async signEURCApprovalTransaction(userId, spender, amount, contracts, chainId) {
		const { forwarder, eurcToken } = contracts;

		// Get user's wallet
		const wallet = await this.getUserWallet(userId);
		const userAddress = wallet.address;

		// Get nonce
		const nonce = await forwarder.getNonce(userAddress);

		// Build deadline (1 hour from now)
		const deadline = Math.floor(Date.now() / 1000) + 3600;

		// Encode the approve function call
		const data = eurcToken.interface.encodeFunctionData('approve', [spender, amount]);

		// Build the meta-transaction
		const metaTx = {
			from: userAddress,
			to: await eurcToken.getAddress(),
			value: 0n,
			data,
			nonce,
			deadline,
		};

		// Build EIP-712 typed data
		const domain = {
			name: 'PropertyRental',
			version: '1',
			chainId,
			verifyingContract: await forwarder.getAddress(),
		};

		const types = {
			MetaTransaction: [
				{ name: 'from', type: 'address' },
				{ name: 'to', type: 'address' },
				{ name: 'value', type: 'uint256' },
				{ name: 'data', type: 'bytes' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		};

		const message = {
			from: metaTx.from,
			to: metaTx.to,
			value: metaTx.value,
			data: metaTx.data,
			nonce: metaTx.nonce,
			deadline: metaTx.deadline,
		};

		// Sign the typed data
		const signature = await wallet.signTypedData(domain, types, message);

		return {
			metaTx: {
				from: metaTx.from,
				to: metaTx.to,
				value: metaTx.value.toString(),
				data: metaTx.data,
				nonce: metaTx.nonce.toString(),
				deadline: metaTx.deadline,
				signature,
			},
			signature,
			userAddress,
		};
	}

	/**
	 * Sign a meta-transaction for EURC booking (with on-chain payment)
	 * @param {number} userId - The Strapi user ID
	 * @param {Object} bookingData - Booking data { propertyId, checkInDate, checkOutDate, totalAmount, bookingURI }
	 * @param {Object} contracts - Contract instances { forwarder, bookingManager }
	 * @param {number} chainId - The chain ID
	 * @returns {Object} The signed meta-transaction
	 */
	async signEURCBookingTransaction(userId, bookingData, contracts, chainId) {
		const { forwarder, bookingManager } = contracts;

		// Get user's wallet
		const wallet = await this.getUserWallet(userId);
		const userAddress = wallet.address;

		// Get nonce
		const nonce = await forwarder.getNonce(userAddress);

		// Build deadline (1 hour from now)
		const deadline = Math.floor(Date.now() / 1000) + 3600;

		// Encode the createBooking function call (EURC version)
		const data = bookingManager.interface.encodeFunctionData('createBooking', [
			bookingData.propertyId,
			bookingData.checkInDate,
			bookingData.checkOutDate,
			bookingData.totalAmount,
			bookingData.bookingURI,
		]);

		// Build the meta-transaction
		const metaTx = {
			from: userAddress,
			to: await bookingManager.getAddress(),
			value: 0n, // EURC is transferred via the contract, not msg.value
			data,
			nonce,
			deadline,
		};

		// Build EIP-712 typed data
		const domain = {
			name: 'PropertyRental',
			version: '1',
			chainId,
			verifyingContract: await forwarder.getAddress(),
		};

		const types = {
			MetaTransaction: [
				{ name: 'from', type: 'address' },
				{ name: 'to', type: 'address' },
				{ name: 'value', type: 'uint256' },
				{ name: 'data', type: 'bytes' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		};

		const message = {
			from: metaTx.from,
			to: metaTx.to,
			value: metaTx.value,
			data: metaTx.data,
			nonce: metaTx.nonce,
			deadline: metaTx.deadline,
		};

		// Sign the typed data
		const signature = await wallet.signTypedData(domain, types, message);

		return {
			metaTx: {
				from: metaTx.from,
				to: metaTx.to,
				value: metaTx.value.toString(),
				data: metaTx.data,
				nonce: metaTx.nonce.toString(),
				deadline: metaTx.deadline,
				signature,
			},
			signature,
			userAddress,
		};
	}

	/**
	 * Check if custodial signing is available
	 * @returns {boolean}
	 */
	isAvailable() {
		return !!this.encryptionKey && !!this.strapiToken;
	}
}

module.exports = CustodialSigner;
