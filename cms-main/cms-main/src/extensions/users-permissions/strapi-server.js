const { ethers } = require('ethers');
const crypto = require('crypto');

// Wallet generation configuration
const WALLET_MASTER_MNEMONIC = process.env.WALLET_MASTER_MNEMONIC;
const WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
const IV_LENGTH = 16;

/**
 * Generate a deterministic wallet for a user based on their ID
 * Uses HD derivation path: m/44'/60'/0'/0/{userId}
 */
function generateUserWallet(userId) {
	if (!WALLET_MASTER_MNEMONIC) {
		throw new Error('WALLET_MASTER_MNEMONIC environment variable not set');
	}

	// Create mnemonic object
	const mnemonic = ethers.Mnemonic.fromPhrase(WALLET_MASTER_MNEMONIC);

	// Derive directly to the user's path using the full derivation
	const userWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${userId}`);

	return {
		address: userWallet.address,
		privateKey: userWallet.privateKey,
	};
}

/**
 * Encrypt a private key using AES-256-GCM
 */
function encryptPrivateKey(privateKey) {
	if (!WALLET_ENCRYPTION_KEY) {
		throw new Error('WALLET_ENCRYPTION_KEY environment variable not set');
	}

	const key = Buffer.from(WALLET_ENCRYPTION_KEY, 'hex');
	if (key.length !== 32) {
		throw new Error('WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
	}

	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

	let encrypted = cipher.update(privateKey, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	return {
		iv: iv.toString('hex'),
		encryptedData: encrypted,
		authTag: authTag.toString('hex'),
	};
}

module.exports = (plugin) => {
	// Keep the existing linkWallet controller for backwards compatibility
	plugin.controllers.user = {
		...plugin.controllers.user,
		async linkWallet(ctx) {
			try {
				const authUser = ctx.state.user;
				if (!authUser) {
					return ctx.unauthorized('Authentication required');
				}
				const { walletAddress, message, signature } = ctx.request.body || {};
				if (!walletAddress || !message || !signature) {
					return ctx.badRequest('Missing walletAddress, message or signature');
				}

				// Verify signature
				let recovered;
				try {
					recovered = ethers.verifyMessage(message, signature);
				} catch (err) {
					return ctx.badRequest('Invalid signature');
				}
				if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
					return ctx.badRequest('Signature does not match walletAddress');
				}

				// Ensure uniqueness
				const existing = await strapi
					.query('plugin::users-permissions.user')
					.findOne({ where: { walletAddress: walletAddress.toLowerCase() } });
				if (existing && existing.id !== authUser.id) {
					return ctx.conflict('Wallet already linked to another account');
				}

				// Update current user
				await strapi.query('plugin::users-permissions.user').update({
					where: { id: authUser.id },
					data: { walletAddress: walletAddress.toLowerCase() },
				});

				ctx.body = { success: true, walletAddress: walletAddress.toLowerCase() };
			} catch (error) {
				ctx.throw(500, error);
			}
		},
	};

	plugin.routes['content-api'].routes.push({
		method: 'POST',
		path: '/link-wallet',
		handler: 'user.linkWallet',
		config: {
			policies: [],
		},
	});

	// Override the register controller to auto-generate wallets
	const originalRegister = plugin.controllers.auth.register;

	plugin.controllers.auth.register = async (ctx) => {
		// Call the original register function
		const result = await originalRegister(ctx);

		// If registration was successful (user was created), generate wallet
		// The response body contains the user object with id
		if (ctx.response.status === 200 && ctx.response.body?.user?.id) {
			const userId = ctx.response.body.user.id;

			try {
				// Check if wallet env vars are configured
				if (!WALLET_MASTER_MNEMONIC || !WALLET_ENCRYPTION_KEY) {
					console.warn(`⚠️ Wallet generation skipped for user ${userId}: Missing WALLET_MASTER_MNEMONIC or WALLET_ENCRYPTION_KEY`);
					return result;
				}

				// Generate wallet
				const wallet = generateUserWallet(userId);
				const encrypted = encryptPrivateKey(wallet.privateKey);

				// Update user with wallet info
				await strapi.query('plugin::users-permissions.user').update({
					where: { id: userId },
					data: {
						walletAddress: wallet.address.toLowerCase(),
						encryptedPrivateKey: encrypted,
						walletCreatedAt: new Date(),
					},
				});

				console.log(`✅ Generated custodial wallet for user ${userId}: ${wallet.address}`);

				// Update the response to include the wallet address
				ctx.response.body.user.walletAddress = wallet.address.toLowerCase();
			} catch (error) {
				// Log error but don't fail registration
				console.error(`❌ Failed to generate wallet for user ${userId}:`, error.message);
			}
		}

		return result;
	};

	return plugin;
};
