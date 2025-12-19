const { ethers } = require('ethers');
const CustodialSigner = require('./custodial-signer');
const IPFSService = require('./ipfs-service');

/**
 * PropertySyncService - Syncs property listings from CMS to blockchain
 *
 * When a property is created or updated in Strapi CMS, this service:
 * 1. Pins the property metadata to IPFS
 * 2. Signs the transaction with the owner's custodial wallet (or admin wallet if no owner)
 * 3. Submits the transaction via meta-transaction forwarder
 * 4. Auto-creates CDP wallet for the host (for receiving payouts)
 *
 * This ensures all CMS properties are also on-chain for transparency and immutability.
 */
class PropertySyncService {
	constructor(config = {}) {
		this.custodialSigner = new CustodialSigner(config);
		this.ipfsService = new IPFSService(config);

		// CDP wallet service reference (set externally via setCDPWalletService)
		this.cdpWalletService = null;

		// Blockchain connections (set by initialize())
		this.provider = null;
		this.relayer = null;
		this.forwarder = null;
		this.propertyMarketplace = null;
		this.chainId = null;

		// Admin wallet for properties without owners
		this.adminMnemonic = config.adminMnemonic || process.env.WALLET_MASTER_MNEMONIC;

		// Track sync operations to prevent duplicates
		this.syncingProperties = new Set();

		// Track recently synced properties to prevent update loops
		// Maps propertyId -> timestamp when it was synced
		this.recentlySyncedProperties = new Map();
		this.RECENTLY_SYNCED_WINDOW_MS = 30000; // 30 seconds

		// Flag to indicate bulk sync is in progress - blocks webhook updates
		this.bulkSyncInProgress = false;
	}

	/**
	 * Initialize with blockchain connections
	 */
	initialize(blockchainConfig) {
		this.provider = blockchainConfig.provider;
		this.relayer = blockchainConfig.relayer;
		this.forwarder = blockchainConfig.forwarder;
		this.propertyMarketplace = blockchainConfig.propertyMarketplace;
		this.chainId = blockchainConfig.chainId;

		console.log('✅ PropertySyncService initialized');
	}

	/**
	 * Set CDP wallet service reference (for auto-creating host wallets)
	 */
	setCDPWalletService(cdpWalletService) {
		this.cdpWalletService = cdpWalletService;
		console.log('   📎 CDP wallet service linked to PropertySyncService');
	}

	/**
	 * Ensure host has a CDP wallet (auto-create if not)
	 * @param {number} ownerId - Strapi user ID of the property owner
	 */
	async ensureHostCDPWallet(ownerId) {
		if (!this.cdpWalletService || !this.cdpWalletService.isReady()) {
			console.log(`   ⚠️ CDP wallet service not available - skipping auto-wallet creation`);
			return null;
		}

		if (!ownerId) {
			console.log(`   ⚠️ No owner ID - skipping CDP wallet creation`);
			return null;
		}

		try {
			const result = await this.cdpWalletService.createHostWallet(ownerId);

			if (result.success) {
				if (result.existing) {
					console.log(`   ✅ Host already has CDP wallet: ${result.address}`);
				} else {
					console.log(`   🔐 Created CDP wallet for host: ${result.address}`);
				}
				return result.address;
			} else {
				console.log(`   ⚠️ Failed to create CDP wallet: ${result.error}`);
				return null;
			}
		} catch (error) {
			console.log(`   ⚠️ CDP wallet creation error: ${error.message}`);
			return null;
		}
	}

	/**
	 * Check if service is ready
	 */
	isReady() {
		return !!(
			this.provider &&
			this.relayer &&
			this.forwarder &&
			this.propertyMarketplace &&
			this.chainId &&
			this.ipfsService.isAvailable()
		);
	}

	/**
	 * Check if a property was recently synced (to prevent update loops)
	 */
	wasRecentlySynced(cmsId) {
		const syncTime = this.recentlySyncedProperties.get(cmsId);
		if (!syncTime) return false;

		const elapsed = Date.now() - syncTime;
		if (elapsed < this.RECENTLY_SYNCED_WINDOW_MS) {
			return true;
		}

		// Clean up expired entry
		this.recentlySyncedProperties.delete(cmsId);
		return false;
	}

	/**
	 * Mark a property as recently synced
	 */
	markRecentlySynced(cmsId) {
		this.recentlySyncedProperties.set(cmsId, Date.now());

		// Schedule cleanup
		setTimeout(() => {
			this.recentlySyncedProperties.delete(cmsId);
		}, this.RECENTLY_SYNCED_WINDOW_MS + 1000);
	}

	/**
	 * Get the wallet for signing a property transaction
	 * Uses owner's custodial wallet if available, otherwise admin wallet
	 */
	async getSignerWallet(ownerId) {
		if (ownerId) {
			try {
				const wallet = await this.custodialSigner.getUserWallet(ownerId);
				return { wallet, isAdmin: false };
			} catch (error) {
				console.warn(`⚠️ Could not get owner wallet for user ${ownerId}: ${error.message}`);
				// Fall through to admin wallet
			}
		}

		// Use admin wallet (derived from master mnemonic at index 0)
		if (!this.adminMnemonic) {
			throw new Error('No owner wallet and no admin mnemonic configured');
		}

		// Use Wallet.fromPhrase which derives to standard path m/44'/60'/0'/0/0 by default
		const adminWallet = ethers.Wallet.fromPhrase(this.adminMnemonic);

		return { wallet: adminWallet, isAdmin: true };
	}

	/**
	 * Build metadata object for IPFS from CMS property data
	 */
	buildPropertyMetadata(propertyData) {
		return {
			title: propertyData.Title || 'Untitled Property',
			description: this.extractTextFromBlocks(propertyData.Description),
			address: propertyData.FormattedAddress || '',
			location: this.extractTextFromBlocks(propertyData.Location) || propertyData.FormattedAddress || '',
			rooms: propertyData.Rooms || 1,
			bathrooms: propertyData.Bathrooms || 1,
			size: propertyData.Size || '',
			latitude: propertyData.Latitude || 0,
			longitude: propertyData.Longitude || 0,
			maxGuests: propertyData.MaxGuests || 2,
			cleaningFee: propertyData.CleaningFee || 0,
			rating: propertyData.Stars || 5,
			pricePerNight: propertyData.PricePerNight || 0,
			currency: propertyData.currency?.code || 'USD',
			amenities: (propertyData.property_amenities || []).map(a => a.Name || a.name),
			images: (propertyData.Images || []).map(img => img.url),
			propertyType: propertyData.property_type?.Name || 'Property',
			featured: propertyData.Featured || false,
			cmsId: propertyData.id || propertyData.documentId,
			createdAt: new Date().toISOString(),
		};
	}

	/**
	 * Extract plain text from Strapi blocks format
	 */
	extractTextFromBlocks(blocks) {
		if (!blocks) return '';
		if (typeof blocks === 'string') return blocks;
		if (!Array.isArray(blocks)) return '';

		return blocks
			.map(block => {
				if (block.type === 'paragraph' && block.children) {
					return block.children.map(child => child.text || '').join('');
				}
				return '';
			})
			.filter(Boolean)
			.join('\n');
	}

	/**
	 * Sign a meta-transaction for listing a property
	 */
	async signListPropertyTransaction(wallet, propertyURI, pricePerNightWei, tokenName, tokenSymbol) {
		const userAddress = wallet.address;

		// Get nonce
		const nonce = await this.forwarder.getNonce(userAddress);

		// Build deadline (1 hour from now)
		const deadline = Math.floor(Date.now() / 1000) + 3600;

		// Encode the function call
		const data = this.propertyMarketplace.interface.encodeFunctionData(
			'listProperty',
			[propertyURI, pricePerNightWei, tokenName, tokenSymbol]
		);

		// Build the meta-transaction
		const metaTx = {
			from: userAddress,
			to: await this.propertyMarketplace.getAddress(),
			value: 0n,
			data,
			nonce,
			deadline,
		};

		// Build EIP-712 typed data
		const domain = {
			name: 'PropertyRental',
			version: '1',
			chainId: this.chainId,
			verifyingContract: await this.forwarder.getAddress(),
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

		// Sign
		const signature = await wallet.signTypedData(domain, types, {
			from: metaTx.from,
			to: metaTx.to,
			value: metaTx.value,
			data: metaTx.data,
			nonce: metaTx.nonce,
			deadline: metaTx.deadline,
		});

		return {
			metaTx: {
				from: metaTx.from,
				to: metaTx.to,
				value: metaTx.value,
				data: metaTx.data,
				nonce: metaTx.nonce,
				deadline: metaTx.deadline,
				signature,
			},
			userAddress,
		};
	}

	/**
	 * Sign a meta-transaction for updating property price/status
	 */
	async signUpdatePropertyTransaction(wallet, propertyId, pricePerNightWei, isActive) {
		const userAddress = wallet.address;
		const nonce = await this.forwarder.getNonce(userAddress);
		const deadline = Math.floor(Date.now() / 1000) + 3600;

		const data = this.propertyMarketplace.interface.encodeFunctionData(
			'updateProperty',
			[propertyId, pricePerNightWei, isActive]
		);

		const metaTx = {
			from: userAddress,
			to: await this.propertyMarketplace.getAddress(),
			value: 0n,
			data,
			nonce,
			deadline,
		};

		const domain = {
			name: 'PropertyRental',
			version: '1',
			chainId: this.chainId,
			verifyingContract: await this.forwarder.getAddress(),
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

		const signature = await wallet.signTypedData(domain, types, {
			from: metaTx.from,
			to: metaTx.to,
			value: metaTx.value,
			data: metaTx.data,
			nonce: metaTx.nonce,
			deadline: metaTx.deadline,
		});

		return {
			metaTx: { ...metaTx, signature },
			userAddress,
		};
	}

	/**
	 * Sign a meta-transaction for updating property metadata
	 */
	async signUpdateMetadataTransaction(wallet, propertyId, propertyURI) {
		const userAddress = wallet.address;
		const nonce = await this.forwarder.getNonce(userAddress);
		const deadline = Math.floor(Date.now() / 1000) + 3600;

		const data = this.propertyMarketplace.interface.encodeFunctionData(
			'updatePropertyMetadata',
			[propertyId, propertyURI]
		);

		const metaTx = {
			from: userAddress,
			to: await this.propertyMarketplace.getAddress(),
			value: 0n,
			data,
			nonce,
			deadline,
		};

		const domain = {
			name: 'PropertyRental',
			version: '1',
			chainId: this.chainId,
			verifyingContract: await this.forwarder.getAddress(),
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

		const signature = await wallet.signTypedData(domain, types, {
			from: metaTx.from,
			to: metaTx.to,
			value: metaTx.value,
			data: metaTx.data,
			nonce: metaTx.nonce,
			deadline: metaTx.deadline,
		});

		return {
			metaTx: { ...metaTx, signature },
			userAddress,
		};
	}

	/**
	 * Execute a signed meta-transaction
	 */
	async executeMetaTransaction(signedTx) {
		const { from, to, value, data, nonce, deadline, signature } = signedTx.metaTx;

		const tx = await this.forwarder.executeMetaTransaction(
			from,
			to,
			BigInt(value),
			data,
			deadline,
			signature
		);
		const receipt = await tx.wait();

		return {
			transactionHash: receipt.hash,
			blockNumber: receipt.blockNumber,
			logs: receipt.logs,
		};
	}

	/**
	 * Sync a new property from CMS to blockchain
	 *
	 * @param {Object} propertyData - The Strapi property data
	 * @returns {Object} { success, blockchainPropertyId, transactionHash, ipfsUri }
	 */
	async syncNewProperty(propertyData) {
		const cmsId = propertyData.id || propertyData.documentId;

		// Prevent duplicate sync operations
		if (this.syncingProperties.has(cmsId)) {
			console.log(`⏳ Property ${cmsId} sync already in progress`);
			return { success: false, error: 'Sync already in progress' };
		}

		// Skip if already has blockchain ID
		if (propertyData.BlockchainPropertyId) {
			console.log(`✅ Property ${cmsId} already on blockchain: ${propertyData.BlockchainPropertyId}`);
			return { success: true, blockchainPropertyId: propertyData.BlockchainPropertyId, alreadySynced: true };
		}

		if (!this.isReady()) {
			console.warn('⚠️ PropertySyncService not ready');
			return { success: false, error: 'Service not ready' };
		}

		this.syncingProperties.add(cmsId);

		try {
			console.log(`📤 Syncing new property to blockchain: ${propertyData.Title} (CMS ID: ${cmsId})`);

			// Get the owner's user ID
			const ownerId = propertyData.users_permissions_user?.id || propertyData.users_permissions_user;

			// Auto-create CDP wallet for host (for receiving payouts)
			await this.ensureHostCDPWallet(ownerId);

			// Get signer wallet
			const { wallet, isAdmin } = await this.getSignerWallet(ownerId);
			console.log(`  👤 Signer: ${wallet.address} (${isAdmin ? 'admin' : 'owner'})`);

			// Build and pin metadata to IPFS
			const metadata = this.buildPropertyMetadata(propertyData);
			const ipfsResult = await this.ipfsService.pinJSON(metadata, `property-${cmsId}`);
			console.log(`  📌 Pinned to IPFS: ${ipfsResult.uri}`);

			// Convert price to wei (assuming price is in ETH for simplicity, or use a conversion)
			const pricePerNightWei = ethers.parseEther(String(propertyData.PricePerNight || '0.01'));

			// Generate token name and symbol
			const tokenName = `${propertyData.Title || 'Property'} Token`;
			const tokenSymbol = `PROP${cmsId}`.substring(0, 10).toUpperCase();

			// Sign the transaction
			const signedTx = await this.signListPropertyTransaction(
				wallet,
				ipfsResult.uri,
				pricePerNightWei,
				tokenName,
				tokenSymbol
			);
			console.log(`  ✍️ Transaction signed`);

			// Execute via relayer
			const result = await this.executeMetaTransaction(signedTx);
			console.log(`  📤 Transaction submitted: ${result.transactionHash}`);

			// Extract property ID from event
			let blockchainPropertyId = null;
			for (const log of result.logs) {
				try {
					const parsed = this.propertyMarketplace.interface.parseLog({
						topics: log.topics,
						data: log.data,
					});
					if (parsed && parsed.name === 'PropertyListed') {
						blockchainPropertyId = parsed.args.propertyId;
						break;
					}
				} catch (e) {
					// Not a matching log
				}
			}

			console.log(`  🎉 Property listed on blockchain: ${blockchainPropertyId}`);

			// Mark as recently synced to prevent immediate update loops
			this.markRecentlySynced(cmsId);

			return {
				success: true,
				blockchainPropertyId,
				transactionHash: result.transactionHash,
				ipfsUri: ipfsResult.uri,
				ownerAddress: wallet.address,
				isAdminOwned: isAdmin,
			};
		} catch (error) {
			console.error(`  ❌ Failed to sync property ${cmsId}:`, error.message);
			return { success: false, error: error.message };
		} finally {
			this.syncingProperties.delete(cmsId);
		}
	}

	/**
	 * Sync property updates from CMS to blockchain
	 *
	 * @param {Object} propertyData - The updated Strapi property data
	 * @param {Object} previousData - The previous property data (for comparison)
	 * @returns {Object} { success, transactionHash }
	 */
	async syncPropertyUpdate(propertyData, previousData = {}) {
		const blockchainPropertyId = propertyData.BlockchainPropertyId;
		const cmsId = propertyData.id || propertyData.documentId;

		if (!blockchainPropertyId) {
			// Property not on blockchain yet - sync as new
			return this.syncNewProperty(propertyData);
		}

		// Check if bulk sync is in progress - skip all webhook updates during bulk sync
		if (this.bulkSyncInProgress) {
			console.log(`⏭️ Skipping update for ${cmsId} - bulk sync in progress`);
			return { success: true, skipped: true, reason: 'Bulk sync in progress' };
		}

		// Check if this property was recently synced (prevents update loops when we update CMS with BlockchainPropertyId)
		if (this.wasRecentlySynced(cmsId)) {
			console.log(`⏭️ Skipping update for ${cmsId} - recently synced (preventing update loop)`);
			return { success: true, skipped: true, reason: 'Recently synced' };
		}

		if (this.syncingProperties.has(cmsId)) {
			return { success: false, error: 'Sync already in progress' };
		}

		if (!this.isReady()) {
			return { success: false, error: 'Service not ready' };
		}

		this.syncingProperties.add(cmsId);

		try {
			console.log(`📤 Syncing property update to blockchain: ${blockchainPropertyId}`);

			// Fetch current on-chain state
			const onChainProperty = await this.propertyMarketplace.properties(blockchainPropertyId);
			const [, , onChainOwner, onChainPriceWei, onChainIsActive, onChainURI] = onChainProperty;

			// Determine what changed
			const newPriceWei = ethers.parseEther(String(propertyData.PricePerNight || '0.01'));
			const newIsActive = !propertyData.CurrentlyRented;

			const priceChanged = newPriceWei !== onChainPriceWei;
			const statusChanged = newIsActive !== onChainIsActive;

			// Check if metadata changed (compare key fields)
			const metadataFields = ['Title', 'Description', 'FormattedAddress', 'Rooms', 'Bathrooms', 'MaxGuests', 'Images'];
			const metadataChanged = metadataFields.some(field => {
				const current = JSON.stringify(propertyData[field]);
				const previous = JSON.stringify(previousData[field]);
				return current !== previous;
			});

			if (!priceChanged && !statusChanged && !metadataChanged) {
				console.log(`  ✅ No blockchain-relevant changes for ${blockchainPropertyId}`);
				return { success: true, noChanges: true };
			}

			// Get the owner's wallet (must match on-chain owner)
			const ownerId = propertyData.users_permissions_user?.id || propertyData.users_permissions_user;
			const { wallet, isAdmin } = await this.getSignerWallet(ownerId);

			// Verify the wallet matches on-chain owner (unless admin can override - future feature)
			if (wallet.address.toLowerCase() !== onChainOwner.toLowerCase()) {
				console.warn(`  ⚠️ Wallet mismatch: CMS owner ${wallet.address} != on-chain owner ${onChainOwner}`);
				// For now, we'll skip - in future could add admin override
				return { success: false, error: 'Owner wallet mismatch' };
			}

			const results = [];

			// Update price/status if changed
			if (priceChanged || statusChanged) {
				console.log(`  📝 Updating price/status: ${ethers.formatEther(newPriceWei)} ETH, active=${newIsActive}`);

				const signedTx = await this.signUpdatePropertyTransaction(
					wallet,
					blockchainPropertyId,
					newPriceWei,
					newIsActive
				);

				const result = await this.executeMetaTransaction(signedTx);
				results.push({ type: 'priceStatus', transactionHash: result.transactionHash });
				console.log(`  ✅ Price/status updated: ${result.transactionHash}`);

				// If we also need to update metadata, wait for nonce to update on-chain
				if (metadataChanged) {
					console.log(`  ⏳ Waiting 5 seconds for nonce to update before metadata transaction...`);
					await new Promise(resolve => setTimeout(resolve, 5000));
				}
			}

			// Update metadata if changed
			if (metadataChanged) {
				console.log(`  📝 Updating metadata`);

				const metadata = this.buildPropertyMetadata(propertyData);
				const ipfsResult = await this.ipfsService.pinJSON(metadata, `property-${cmsId}-update`);
				console.log(`  📌 New metadata pinned: ${ipfsResult.uri}`);

				const signedTx = await this.signUpdateMetadataTransaction(
					wallet,
					blockchainPropertyId,
					ipfsResult.uri
				);

				const result = await this.executeMetaTransaction(signedTx);
				results.push({ type: 'metadata', transactionHash: result.transactionHash, ipfsUri: ipfsResult.uri });
				console.log(`  ✅ Metadata updated: ${result.transactionHash}`);
			}

			return {
				success: true,
				blockchainPropertyId,
				updates: results,
			};
		} catch (error) {
			console.error(`  ❌ Failed to sync property update ${blockchainPropertyId}:`, error.message);
			return { success: false, error: error.message };
		} finally {
			this.syncingProperties.delete(cmsId);
		}
	}

	/**
	 * Remove/deactivate a property on blockchain
	 */
	async syncPropertyRemoval(propertyData) {
		const blockchainPropertyId = propertyData.BlockchainPropertyId;

		if (!blockchainPropertyId) {
			return { success: true, notOnBlockchain: true };
		}

		if (!this.isReady()) {
			return { success: false, error: 'Service not ready' };
		}

		try {
			console.log(`📤 Syncing property removal to blockchain: ${blockchainPropertyId}`);

			// Just set isActive to false via updateProperty
			const ownerId = propertyData.users_permissions_user?.id || propertyData.users_permissions_user;
			const { wallet } = await this.getSignerWallet(ownerId);

			// Get current price
			const onChainProperty = await this.propertyMarketplace.properties(blockchainPropertyId);
			const currentPriceWei = onChainProperty.pricePerNight;

			const signedTx = await this.signUpdatePropertyTransaction(
				wallet,
				blockchainPropertyId,
				currentPriceWei,
				false // Set inactive
			);

			const result = await this.executeMetaTransaction(signedTx);

			console.log(`  ✅ Property deactivated: ${result.transactionHash}`);

			return {
				success: true,
				blockchainPropertyId,
				transactionHash: result.transactionHash,
			};
		} catch (error) {
			console.error(`  ❌ Failed to sync property removal:`, error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get service status
	 */
	getStatus() {
		return {
			isReady: this.isReady(),
			syncingCount: this.syncingProperties.size,
			ipfsAvailable: this.ipfsService.isAvailable(),
			hasRelayer: !!this.relayer,
			chainId: this.chainId,
		};
	}

	/**
	 * Bulk sync all properties from CMS to blockchain
	 * Fetches all properties from Strapi and syncs any that don't have a BlockchainPropertyId
	 *
	 * @param {Object} options - Options for bulk sync
	 * @param {boolean} options.forceResync - If true, resync all properties even if they have a BlockchainPropertyId
	 * @returns {Object} { success, synced, skipped, failed, errors }
	 */
	async bulkSyncFromCMS(options = {}) {
		const { forceResync = false } = options;

		if (!this.isReady()) {
			console.warn('⚠️ Bulk sync skipped: Service not ready');
			return { success: false, error: 'Service not ready', synced: 0, skipped: 0, failed: 0 };
		}

		const strapiBaseUrl = process.env.STRAPI_BASE_URL || 'http://localhost:1337';
		const strapiApiToken = process.env.STRAPI_API_TOKEN;

		if (!strapiApiToken) {
			console.warn('⚠️ Bulk sync skipped: STRAPI_API_TOKEN not configured');
			return { success: false, error: 'STRAPI_API_TOKEN not configured', synced: 0, skipped: 0, failed: 0 };
		}

		console.log('🔄 Starting bulk sync from CMS to blockchain...');

		// Set flag to block webhook updates during bulk sync
		this.bulkSyncInProgress = true;

		const results = {
			success: true,
			synced: 0,
			skipped: 0,
			failed: 0,
			errors: [],
			details: [],
		};

		try {
			// Fetch all properties from Strapi
			const response = await fetch(
				`${strapiBaseUrl}/api/properties?populate=*&pagination[pageSize]=100`,
				{
					headers: {
						Authorization: `Bearer ${strapiApiToken}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch properties from Strapi: ${response.status}`);
			}

			const data = await response.json();
			const properties = data.data || [];

			console.log(`📊 Found ${properties.length} properties in CMS`);

			for (const property of properties) {
				const propertyData = property.attributes || property;
				propertyData.id = property.id;
				propertyData.documentId = property.documentId || property.id;

				const hasBlockchainId = !!propertyData.BlockchainPropertyId;

				// Skip if already synced (unless forceResync)
				if (hasBlockchainId && !forceResync) {
					console.log(`  ⏭️ Skipping ${propertyData.Title} - already synced (${propertyData.BlockchainPropertyId})`);
					results.skipped++;
					results.details.push({
						id: propertyData.id,
						title: propertyData.Title,
						status: 'skipped',
						reason: 'Already synced',
						blockchainPropertyId: propertyData.BlockchainPropertyId,
					});
					continue;
				}

				try {
					console.log(`  📤 Syncing: ${propertyData.Title}`);

					let syncResult;
					if (hasBlockchainId && forceResync) {
						// Force update existing
						syncResult = await this.syncPropertyUpdate(propertyData);
					} else {
						// New sync
						syncResult = await this.syncNewProperty(propertyData);
					}

					if (syncResult.success) {
						results.synced++;
						results.details.push({
							id: propertyData.id,
							title: propertyData.Title,
							status: 'synced',
							blockchainPropertyId: syncResult.blockchainPropertyId,
							transactionHash: syncResult.transactionHash,
						});

						// Update Strapi with the blockchain ID if it's a new sync
						if (syncResult.blockchainPropertyId && !hasBlockchainId) {
							try {
								await fetch(
									`${strapiBaseUrl}/api/properties/${propertyData.documentId || propertyData.id}`,
									{
										method: 'PUT',
										headers: {
											'Content-Type': 'application/json',
											Authorization: `Bearer ${strapiApiToken}`,
										},
										body: JSON.stringify({
											data: {
												BlockchainPropertyId: syncResult.blockchainPropertyId,
											},
										}),
									}
								);
								console.log(`    ✅ Updated CMS with BlockchainPropertyId: ${syncResult.blockchainPropertyId}`);
							} catch (updateErr) {
								console.warn(`    ⚠️ Failed to update CMS: ${updateErr.message}`);
							}
						}
					} else if (syncResult.alreadySynced) {
						results.skipped++;
						results.details.push({
							id: propertyData.id,
							title: propertyData.Title,
							status: 'skipped',
							reason: 'Already synced',
							blockchainPropertyId: syncResult.blockchainPropertyId,
						});
					} else {
						results.failed++;
						results.errors.push({
							id: propertyData.id,
							title: propertyData.Title,
							error: syncResult.error,
						});
						results.details.push({
							id: propertyData.id,
							title: propertyData.Title,
							status: 'failed',
							error: syncResult.error,
						});
					}

					// Longer delay between syncs to avoid nonce/rate limiting issues
					await new Promise(resolve => setTimeout(resolve, 3000));

				} catch (error) {
					results.failed++;
					results.errors.push({
						id: propertyData.id,
						title: propertyData.Title,
						error: error.message,
					});
					results.details.push({
						id: propertyData.id,
						title: propertyData.Title,
						status: 'failed',
						error: error.message,
					});
				}
			}

			console.log(`✅ Bulk sync complete: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`);

			return results;

		} catch (error) {
			console.error('❌ Bulk sync failed:', error.message);
			return {
				success: false,
				error: error.message,
				synced: results.synced,
				skipped: results.skipped,
				failed: results.failed,
			};
		} finally {
			// Always clear the bulk sync flag
			this.bulkSyncInProgress = false;
			console.log('🔓 Bulk sync flag cleared - webhook updates re-enabled');
		}
	}
}

module.exports = PropertySyncService;
