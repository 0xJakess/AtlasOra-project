/**
 * Migration script to generate custodial wallets for existing users
 *
 * This script:
 * 1. Fetches all users from Strapi who don't have a wallet
 * 2. Generates a deterministic HD wallet for each user
 * 3. Encrypts the private key and stores it
 *
 * Usage:
 *   cd cms
 *   node scripts/migrate-wallets.js
 *
 * Environment variables required:
 *   - WALLET_MASTER_MNEMONIC: The master HD wallet mnemonic
 *   - WALLET_ENCRYPTION_KEY: 32-byte hex key for AES-256-GCM encryption
 *   - STRAPI_BASE_URL: Strapi API base URL (default: http://localhost:1337)
 *   - STRAPI_API_TOKEN: API token with admin access
 */

require('dotenv').config();
const { ethers } = require('ethers');
const crypto = require('crypto');

const WALLET_MASTER_MNEMONIC = process.env.WALLET_MASTER_MNEMONIC;
const WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
const STRAPI_BASE_URL = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || process.env.LOCAL_TRANSFER_TOKEN;
const IV_LENGTH = 16;

/**
 * Generate a deterministic wallet for a user based on their ID
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

/**
 * Fetch all users without wallets
 */
async function fetchUsersWithoutWallets() {
	let allUsers = [];
	let page = 1;
	const pageSize = 100;

	while (true) {
		const url = `${STRAPI_BASE_URL}/api/users?pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
		const response = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch users: ${response.status}`);
		}

		const users = await response.json();

		if (!Array.isArray(users) || users.length === 0) {
			break;
		}

		// Filter users without encrypted private key (wallet not generated)
		const usersWithoutWallets = users.filter(user => !user.encryptedPrivateKey);
		allUsers = allUsers.concat(usersWithoutWallets);

		if (users.length < pageSize) {
			break;
		}

		page++;
	}

	return allUsers;
}

/**
 * Update a user with wallet info
 */
async function updateUserWallet(userId, walletData) {
	const url = `${STRAPI_BASE_URL}/api/users/${userId}`;
	const response = await fetch(url, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			walletAddress: walletData.address.toLowerCase(),
			encryptedPrivateKey: walletData.encryptedPrivateKey,
			walletCreatedAt: new Date().toISOString(),
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(`Failed to update user ${userId}: ${JSON.stringify(error)}`);
	}

	return await response.json();
}

/**
 * Main migration function
 */
async function migrate() {
	console.log('🔧 Starting wallet migration...\n');

	// Validate environment
	if (!WALLET_MASTER_MNEMONIC) {
		console.error('❌ WALLET_MASTER_MNEMONIC is not set');
		console.log('\n   Generate a mnemonic with:');
		console.log('   node -e "console.log(require(\'ethers\').Wallet.createRandom().mnemonic.phrase)"');
		process.exit(1);
	}

	if (!WALLET_ENCRYPTION_KEY) {
		console.error('❌ WALLET_ENCRYPTION_KEY is not set');
		console.log('\n   Generate a 32-byte key with:');
		console.log('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
		process.exit(1);
	}

	if (!STRAPI_API_TOKEN) {
		console.error('❌ STRAPI_API_TOKEN is not set');
		process.exit(1);
	}

	console.log(`📡 Strapi URL: ${STRAPI_BASE_URL}`);
	console.log(`🔑 Encryption key: ${WALLET_ENCRYPTION_KEY.substring(0, 8)}...`);
	console.log(`🌱 Mnemonic: ${WALLET_MASTER_MNEMONIC.split(' ').slice(0, 3).join(' ')}...\n`);

	// Fetch users without wallets
	console.log('📥 Fetching users without wallets...');
	const users = await fetchUsersWithoutWallets();
	console.log(`   Found ${users.length} users without wallets\n`);

	if (users.length === 0) {
		console.log('✅ All users already have wallets!');
		return;
	}

	// Generate and assign wallets
	let successCount = 0;
	let errorCount = 0;

	for (const user of users) {
		try {
			console.log(`👤 Processing user ${user.id} (${user.email || user.username})...`);

			// Generate wallet
			const wallet = generateUserWallet(user.id);
			const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);

			// Update user in Strapi
			await updateUserWallet(user.id, {
				address: wallet.address,
				encryptedPrivateKey,
			});

			console.log(`   ✅ Wallet generated: ${wallet.address}`);
			successCount++;
		} catch (error) {
			console.log(`   ❌ Error: ${error.message}`);
			errorCount++;
		}
	}

	console.log('\n📊 Migration Summary:');
	console.log(`   ✅ Success: ${successCount}`);
	console.log(`   ❌ Errors: ${errorCount}`);
	console.log(`   📋 Total: ${users.length}`);
}

// Run migration
migrate().catch(error => {
	console.error('Migration failed:', error);
	process.exit(1);
});
