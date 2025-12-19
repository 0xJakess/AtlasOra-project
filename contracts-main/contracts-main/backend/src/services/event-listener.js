const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const IPFSUtils = require('../utils/ipfs-utils');

class EventListener {
	constructor() {
		this.provider = null;
		this.contracts = {};
		this.isRunning = false;
		this.lastProcessedBlock = 0;
		this.stateFilePath = path.join(process.cwd(), 'event-listener.state');
		this.strapiConfig = {
			baseURL: process.env.STRAPI_BASE_URL || 'http://localhost:1337',
			apiToken: process.env.STRAPI_API_TOKEN,
			timeout: 10000
		};
		this.autoSync = String(process.env.STRAPI_AUTO_SYNC || 'true').toLowerCase() === 'true';
		this.ipfsUtils = new IPFSUtils();
		this.originalOwners = new Map(); // propertyId -> original owner address
		
		// Idempotency tracking
		this.processedEvents = new Set(); // Track processed event transaction hashes
		this.processingEvents = new Set(); // Track events currently being processed
	}

	/**
	 * Normalize event args whether called from ethers listener (...args) or from processEvent({ args })
	 */
	static normalizeArgs(evtOrArgs) {
		if (Array.isArray(evtOrArgs)) return evtOrArgs;
		if (evtOrArgs && Array.isArray(evtOrArgs.args)) return evtOrArgs.args;
		return [];
	}

	/** Load persisted state (lastProcessedBlock) if present */
	loadState() {
		try {
			if (fs.existsSync(this.stateFilePath)) {
				const raw = fs.readFileSync(this.stateFilePath, 'utf8');
				const data = JSON.parse(raw);
				if (data && typeof data.lastProcessedBlock === 'number') {
					return data;
				}
			}
		} catch (_) {}
		return { lastProcessedBlock: 0 };
	}

	/** Persist lastProcessedBlock to disk */
	saveState() {
		try {
			const dir = path.dirname(this.stateFilePath);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(this.stateFilePath, JSON.stringify({ lastProcessedBlock: this.lastProcessedBlock }, null, 2));
		} catch (err) {
			console.warn('⚠️  Failed to persist event listener state:', err.message);
		}
	}

	/**
	 * Initialize the event listener
	 */
	async initialize() {
		console.log('🔧 Initializing Event Listener...');

		// Initialize provider - prefer Base Sepolia, fall back to Viction
		const rpcUrl = process.env.BASE_SEPOLIA_RPC || process.env.VICTION_TESTNET_RPC || 'https://sepolia.base.org';
		this.provider = new ethers.JsonRpcProvider(rpcUrl);
		console.log(`🔗 Event listener connected to RPC: ${rpcUrl}`);

		// Load deployment info - prefer Base Sepolia, fall back to Viction
		const baseSepoliaPath = path.join(__dirname, '/../config/deployment-base-sepolia.json');
		const victionPath = path.join(__dirname, '/../config/deployment-all-viction-testnet.json');

		let deploymentInfo;
		if (fs.existsSync(baseSepoliaPath)) {
			deploymentInfo = JSON.parse(fs.readFileSync(baseSepoliaPath, 'utf8'));
			console.log(`📦 Event listener using Base Sepolia deployment (Chain ID: ${deploymentInfo.chainId})`);
		} else if (fs.existsSync(victionPath)) {
			deploymentInfo = JSON.parse(fs.readFileSync(victionPath, 'utf8'));
			console.log(`📦 Event listener using Viction Testnet deployment (legacy)`);
		} else {
			throw new Error('No deployment configuration found for event listener');
		}
		
		// Initialize contract instances
		const PropertyMarketplaceABI = require('../artifacts/contracts/PropertyMarketplace.sol/PropertyMarketplace.json').abi;
		const BookingManagerABI = require('../artifacts/contracts/BookingManager.sol/BookingManager.json').abi;
		const MetaTransactionForwarderABI = require('../artifacts/contracts/MetaTransactionForwarder.sol/MetaTransactionForwarder.json').abi;
		
		this.contracts.propertyMarketplace = new ethers.Contract(
			deploymentInfo.contracts.PropertyMarketplace,
			PropertyMarketplaceABI,
			this.provider
		);
		
		this.contracts.bookingManager = new ethers.Contract(
			deploymentInfo.contracts.BookingManager,
			BookingManagerABI,
			this.provider
		);
		
		this.contracts.forwarder = new ethers.Contract(
			deploymentInfo.contracts.MetaTransactionForwarder,
			MetaTransactionForwarderABI,
			this.provider
		);
		
		// Determine starting block: use persisted state if present, otherwise current block
		const currentBlock = await this.provider.getBlockNumber();
		const state = this.loadState();
		if (state.lastProcessedBlock && state.lastProcessedBlock > 0 && state.lastProcessedBlock <= currentBlock) {
			this.lastProcessedBlock = state.lastProcessedBlock;
			console.log(`📦 Resuming from last processed block: ${this.lastProcessedBlock}`);
		} else {
			this.lastProcessedBlock = currentBlock;
		console.log(`📦 Starting from block: ${this.lastProcessedBlock}`);
			this.saveState();
		}
		
		console.log('✅ Event listener initialized');
	}

	/**
	 * Start listening to events
	 */
	async start() {
		if (this.isRunning) {
			console.log('⚠️  Event listener is already running');
			return;
		}

		this.isRunning = true;
		console.log('🚀 Starting event listener...');

		// Set up event listeners
		this.setupEventListeners();

		// Start polling for new blocks
		this.startPolling();
	}

	/**
	 * Set up event listeners for all contracts
	 * Note: We use polling-based event fetching instead of filter-based listeners
	 * because public RPCs (like Base Sepolia) don't support long-lived filters.
	 * The actual event handling is done via processNewBlocks() polling.
	 */
	setupEventListeners() {
		// No filter-based listeners - we rely on polling in processNewBlocks()
		// This avoids "filter not found" errors on public RPCs
		console.log('✅ Event handlers configured (using polling mode)');
	}

	/**
	 * Start polling for new blocks
	 */
	startPolling() {
		console.log('🔄 Starting block polling...');
		
		// Process historical events first
		this.processHistoricalEvents();
		
		// Set up polling interval
		setInterval(async () => {
			if (this.isRunning) {
				await this.processNewBlocks();
			}
		}, 5000); // Poll every 5 seconds
	}

	/**
	 * Process historical events from last processed block
	 */
	async processHistoricalEvents() {
		console.log('📚 Processing historical events...');
		
		const currentBlock = await this.provider.getBlockNumber();
		// If resuming from persisted state, continue from the next block; otherwise scan a safety window
		const fromBlock = this.lastProcessedBlock > 0 ? this.lastProcessedBlock + 1 : Math.max(0, currentBlock - 1000);
		
		try {
			// Get all events from all contracts
			const events = await this.getAllEvents(fromBlock, currentBlock);
			
			console.log(`📊 Found ${events.length} historical events`);
			
			// Process events in order
			for (const event of events) {
				await this.processEvent(event);
			}
			
			this.lastProcessedBlock = currentBlock;
			this.saveState();
			console.log('✅ Historical events processed');
			
		} catch (error) {
			console.error('❌ Error processing historical events:', error);
		}
	}

	/**
	 * Process new blocks
	 */
	async processNewBlocks() {
		try {
			const currentBlock = await this.provider.getBlockNumber();
			
			if (currentBlock > this.lastProcessedBlock) {
				console.log(`📦 Processing blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);
				
				const events = await this.getAllEvents(this.lastProcessedBlock + 1, currentBlock);
				
				for (const event of events) {
					await this.processEvent(event);
				}
				
				this.lastProcessedBlock = currentBlock;
				this.saveState();
			}
		} catch (error) {
			console.error('❌ Error processing new blocks:', error);
		}
	}

	/**
	 * Get all events from all contracts
	 */
	async getAllEvents(fromBlock, toBlock) {
		const events = [];
		
		try {
			// Get events from PropertyMarketplace
			const propertyEvents = await this.contracts.propertyMarketplace.queryFilter('*', fromBlock, toBlock);
			events.push(...propertyEvents);
			
			// Get events from BookingManager
			const bookingEvents = await this.contracts.bookingManager.queryFilter('*', fromBlock, toBlock);
			events.push(...bookingEvents);
			
			// Sort events by block number and transaction index
			events.sort((a, b) => {
				if (a.blockNumber !== b.blockNumber) {
					return a.blockNumber - b.blockNumber;
				}
				return a.transactionIndex - b.transactionIndex;
			});
		} catch (error) {
			console.log(`⚠️  Error querying events from blocks ${fromBlock} to ${toBlock}:`, error.message);
		}
		
		return events;
	}

	/**
	 * Process a single event with idempotency checks
	 */
	async processEvent(event) {
		// Handle both custom event objects and ethers event objects
		let eventName, eventArgs, eventTimestamp, transactionHash;
		
		if (event.name) {
			// Custom event object
			eventName = event.name;
			eventArgs = event.args;
			eventTimestamp = event.timestamp;
			transactionHash = event.transactionHash || 'unknown';
		} else if (event.eventName) {
			// Ethers event object
			eventName = event.eventName;
			eventArgs = event.args;
			eventTimestamp = Date.now();
			transactionHash = event.transactionHash || 'unknown';
		} else {
			console.log(`⚠️  Unknown event format:`, event);
			return;
		}
		
		// Create unique event identifier for idempotency (BigInt-safe)
		const safeArgs = JSON.parse(JSON.stringify(eventArgs, (key, val) => (typeof val === 'bigint' ? val.toString() : val)));
		const eventId = `${transactionHash}-${eventName}-${JSON.stringify(safeArgs)}`;
		
		// Check if event is already being processed
		if (this.processingEvents.has(eventId)) {
			console.log(`⏳ Event already being processed: ${eventName} (${transactionHash})`);
			return;
		}
		
		// Check if event has already been processed
		if (this.processedEvents.has(eventId)) {
			console.log(`✅ Event already processed: ${eventName} (${transactionHash})`);
			return;
		}
		
		// Mark event as being processed
		this.processingEvents.add(eventId);
		
		try {
			const handler = this.getEventHandler(eventName);
			
			if (handler) {
				await handler({
					name: eventName,
					args: eventArgs,
					timestamp: eventTimestamp,
					transactionHash: transactionHash
				});
				
				// Mark event as processed
				this.processedEvents.add(eventId);
				console.log(`✅ Event processed successfully: ${eventName} (${transactionHash})`);
			} else {
				console.log(`⚠️  No handler for event: ${eventName}`);
			}
		} catch (error) {
			console.error(`❌ Error processing event ${eventName} (${transactionHash}):`, error);
		} finally {
			// Remove from processing set
			this.processingEvents.delete(eventId);
		}
	}

	/**
	 * Get event handler by name
	 */
	getEventHandler(eventName) {
		const handlers = {
			'PropertyListed': this.handlePropertyListed.bind(this),
			'PropertyUpdated': this.handlePropertyUpdated.bind(this),
			'PropertyRemoved': this.handlePropertyRemoved.bind(this),
			'PropertyMetadataUpdated': this.handlePropertyMetadataUpdated.bind(this),
			'BookingCreated': this.handleBookingCreated.bind(this),
			'BookingCreatedPaid': this.handleBookingCreatedPaid.bind(this),
			'CheckedIn': this.handleCheckedIn.bind(this),
			'BookingCompleted': this.handleBookingCompleted.bind(this),
			'BookingCancelled': this.handleBookingCancelled.bind(this),
			// OpenZeppelin standard events - ignore silently
			'OwnershipTransferred': () => {},
			'Approval': () => {},
			'Transfer': () => {},
		};

		return handlers[eventName];
	}

	// ===== EVENT HANDLERS =====
	
	async handlePropertyListed(evtOrArgs) {
		const [propertyId, tokenAddress, owner] = EventListener.normalizeArgs(evtOrArgs);
		let originalFrom = owner;
		try {
			if (evtOrArgs && evtOrArgs.transactionHash && this.contracts.forwarder) {
				const receipt = await this.provider.getTransactionReceipt(evtOrArgs.transactionHash);
				for (const log of receipt.logs || []) {
					try {
						const parsed = this.contracts.forwarder.interface.parseLog(log);
						if (parsed && parsed.name === 'MetaTransactionExecuted') {
							originalFrom = parsed.args.from;
							break;
						}
					} catch (_) {}
				}
			}
		} catch (_) {}
		console.log(`🏠 Property Listed on blockchain: ${propertyId} by ${originalFrom}`);
		this.originalOwners.set(propertyId, originalFrom);

		// Note: Properties are now created via CMS and synced to blockchain.
		// The CMS lifecycle hook triggers blockchain sync and updates BlockchainPropertyId.
		// This handler only logs the event for monitoring purposes.
		// If a property was created directly on blockchain (legacy), we still track the owner.
	}

	async handlePropertyUpdated(evtOrArgs) {
		const [propertyId, newPricePerNight, isActive] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`📝 Property Updated: ${propertyId} (price: ${ethers.formatEther(newPricePerNight)} ETH, active: ${isActive})`);

		// CMS is now the source of truth - property updates flow from CMS to blockchain.
		// We don't need to sync blockchain events back to CMS as it creates a circular loop.
		// The CMS lifecycle hooks handle CMS → Blockchain sync.
		console.log(`   ℹ️ Skipping CMS update (CMS is source of truth)`);
	}

	async handlePropertyRemoved(evtOrArgs) {
		const [propertyId] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`🗑️  Property Removed: ${propertyId}`);

		// CMS is now the source of truth - property removal should be done through CMS.
		// We don't need to sync blockchain events back to CMS as it creates a circular loop.
		console.log(`   ℹ️ Skipping CMS update (CMS is source of truth)`);
	}

	async handlePropertyMetadataUpdated(evtOrArgs) {
		const [propertyId, newPropertyURI] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`📝 Property Metadata Updated: ${propertyId} -> ${newPropertyURI}`);

		// CMS is now the source of truth - property updates flow from CMS to blockchain.
		// We don't need to sync blockchain events back to CMS as it creates a circular loop.
		// The CMS lifecycle hooks handle CMS → Blockchain sync.
		console.log(`   ℹ️ Skipping CMS update (CMS is source of truth)`);
	}

	async handleBookingCreated(evtOrArgs) {
		const [bookingId, propertyId, guest, checkInDate, amount] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`📅 Booking Created: ${bookingId} for ${propertyId}`);

		try {
			// Fetch complete booking data from blockchain
			const bookingData = await this.contracts.bookingManager.bookings(bookingId);

			// Create booking in Strapi
			await this.createBookingInStrapi({
				bookingId: bookingId.toString(),
				propertyId,
				guest,
				checkInDate: new Date(Number(checkInDate) * 1000),
				checkOutDate: new Date(Number(bookingData.checkOutDate) * 1000),
				totalAmount: ethers.formatEther(bookingData.totalAmount),
				platformFee: ethers.formatEther(bookingData.platformFee),
				hostAmount: ethers.formatEther(bookingData.hostAmount),
				status: this.getBookingStatusString(bookingData.status),
				numberOfNights: Math.ceil((Number(bookingData.checkOutDate) - Number(checkInDate)) / (24 * 60 * 60)),
				paidViaFiat: false
			});

		} catch (error) {
			console.error(`❌ Error handling BookingCreated for ${bookingId}:`, error);
		}
	}

	async handleBookingCreatedPaid(evtOrArgs) {
		const [bookingId, propertyId, guest, checkInDate, checkOutDate, totalAmount, paymentReference, bookingURI] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`💳 Paid Booking Created: ${bookingId} for ${propertyId} (Payment ref: ${paymentReference})`);

		try {
			// Fetch complete booking data from blockchain
			const bookingData = await this.contracts.bookingManager.bookings(bookingId);

			// Determine if this is fiat or crypto based on payment reference
			const isCryptoPayment = paymentReference && paymentReference.startsWith('crypto:');

			// Create booking in Strapi with external payment fields
			await this.createBookingInStrapi({
				bookingId: bookingId.toString(),
				propertyId,
				guest,
				checkInDate: new Date(Number(checkInDate) * 1000),
				checkOutDate: new Date(Number(checkOutDate) * 1000),
				totalAmount: bookingData.totalAmount.toString(),
				platformFee: bookingData.platformFee.toString(),
				hostAmount: bookingData.hostAmount.toString(),
				status: this.getBookingStatusString(bookingData.status),
				numberOfNights: Math.ceil((Number(checkOutDate) - Number(checkInDate)) / (24 * 60 * 60)),
				paidOffChain: true,
				paymentMethod: isCryptoPayment ? 'Crypto (ETH)' : 'Credit Card',
				paymentReference,
				ipfsUri: bookingURI
			});

		} catch (error) {
			console.error(`❌ Error handling BookingCreatedPaid for ${bookingId}:`, error);
		}
	}

	async handleCheckedIn(evtOrArgs) {
		const [bookingId, guest] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`✅ Checked In: ${bookingId}`);
		
		try {
			// Update booking status in Strapi
			await this.updateBookingInStrapi(bookingId, {
				BookingStatus: 'Active'
			});
			
		} catch (error) {
			console.error(`❌ Error handling CheckedIn for ${bookingId}:`, error);
		}
	}

	async handleBookingCompleted(evtOrArgs) {
		const [bookingId] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`🎉 Booking Completed: ${bookingId}`);

		try {
			// Update booking status in Strapi
			await this.updateBookingInStrapi(bookingId, {
				BookingStatus: 'Complete'
			});

			// Trigger payout callback if configured
			if (this.onBookingCompleted) {
				try {
					await this.onBookingCompleted(bookingId);
				} catch (callbackError) {
					console.error(`   ⚠️ Payout callback error:`, callbackError.message);
				}
			}

		} catch (error) {
			console.error(`❌ Error handling BookingCompleted for ${bookingId}:`, error);
		}
	}

	async handleBookingCancelled(evtOrArgs) {
		const [bookingId] = EventListener.normalizeArgs(evtOrArgs);
		console.log(`❌ Booking Cancelled: ${bookingId}`);
		
		try {
			// Update booking status in Strapi
			await this.updateBookingInStrapi(bookingId, {
				BookingStatus: 'Cancelled'
			});
			
		} catch (error) {
			console.error(`❌ Error handling BookingCancelled for ${bookingId}:`, error);
		}
	}

	// ===== STRAPI INTEGRATION =====
	
	/**
	 * Create a property in Strapi with idempotency checks
	 */
	async createPropertyInStrapi(propertyData) {
		if (!this.autoSync) {
			console.log('⏸️  Auto-sync disabled. Skipping property create in Strapi.');
			return null;
		}
		try {
			const rawMetaTitle = (propertyData.title || 'Property').trim();
			const isGenericTitle = (t) => {
				const v = (t || '').toLowerCase();
				return v === 'property' || v === 'property from blockchain';
			};
			// If metadata title is generic, disambiguate by appending the chain id
			let canonicalTitle = isGenericTitle(rawMetaTitle)
				? `${rawMetaTitle} ${propertyData.propertyId}`.trim()
				: rawMetaTitle;
			
			// Check if property already exists by blockchain propertyId
			const existingProperties = await this.findPropertyByBlockchainId(propertyData.propertyId);
			if (existingProperties.length > 0) {
				console.log(`✅ Property already exists in Strapi: ${propertyData.propertyId} (Strapi ID: ${existingProperties[0].id})`);
				return existingProperties[0];
			}

			// Legacy fallback: find by Title contains propertyId and update in-place
			try {
				const legacyMatches = await axios.get(
					`${this.strapiConfig.baseURL}/api/properties`,
					{
						params: { 'filters[Title][$contains]': propertyData.propertyId },
						headers: { 'Authorization': `Bearer ${this.strapiConfig.apiToken}` },
						timeout: this.strapiConfig.timeout,
					}
				);
				const legacy = (legacyMatches.data?.data || [])[0];
				if (legacy && (legacy.documentId || legacy.id)) {
					const legacyDocId = legacy.documentId || legacy.id;
					await axios.put(
						`${this.strapiConfig.baseURL}/api/properties/${legacyDocId}`,
						{ data: { Title: canonicalTitle, BlockchainPropertyId: propertyData.propertyId } },
						{ headers: { 'Authorization': `Bearer ${this.strapiConfig.apiToken}` } }
					);
					console.log(`🔁 Updated legacy property ${legacyDocId} with BlockchainPropertyId ${propertyData.propertyId}`);
					return legacy;
				}
			} catch (e) {
				console.warn('⚠️  Legacy Title-contains search/update failed:', e?.message || e);
			}

			// If a record exists with the same title but no chain id, update it; otherwise adjust title for uniqueness
			try {
				const dupByTitle = await this.findPropertyByTitle(canonicalTitle);
				if (dupByTitle.length > 0) {
					const rec = dupByTitle[0];
					const hasChainId = !!(rec?.attributes?.BlockchainPropertyId || rec?.BlockchainPropertyId);
					if (!hasChainId) {
						const recDocId = rec.documentId || rec.id;
						await axios.put(
							`${this.strapiConfig.baseURL}/api/properties/${recDocId}`,
							{ data: { BlockchainPropertyId: propertyData.propertyId, Title: canonicalTitle } },
							{ headers: { 'Authorization': `Bearer ${this.strapiConfig.apiToken}` } }
						);
						console.log(`🔁 Updated duplicate-by-title record ${recDocId} with BlockchainPropertyId ${propertyData.propertyId}`);
						return rec;
					}
					// Title is already taken by another property; disambiguate this creation by appending id
					if (!canonicalTitle.endsWith(propertyData.propertyId)) {
						canonicalTitle = `${canonicalTitle} ${propertyData.propertyId}`.trim();
					}
				}
			} catch (_) {}
			
			// Resolve user relation by walletAddress if available
			let userRelation = {};
			try {
				const user = await this.findUserByWalletAddress(propertyData.owner);
				if (user && user.id) {
					userRelation = { users_permissions_user: user.id };
				}
			} catch (_) {}
			
			const response = await axios.post(
				`${this.strapiConfig.baseURL}/api/properties`,
				{
					data: {
						Title: canonicalTitle,
						BlockchainPropertyId: propertyData.propertyId,
						FormattedAddress: propertyData.address || 'Address not available',
						PricePerNight: parseFloat(propertyData.pricePerNight),
						Rooms: propertyData.rooms || 1,
						Bathrooms: propertyData.bathrooms || 1,
						Size: propertyData.size || 'Not specified',
						PurchasePrice: 0,
						Latitude: propertyData.latitude || 0,
						Longitude: propertyData.longitude || 0,
						Featured: false,
						CurrentlyRented: !propertyData.isActive,
						Stars: propertyData.rating || 5,
						MaxGuests: propertyData.maxGuests || 2,
						CleaningFee: propertyData.cleaningFee || 0,
						AtlasFees: 0.5,
						Description: propertyData.description || 'Property description not available',
						Location: propertyData.location || 'Location not available',
						publishedAt: new Date().toISOString(),
						...userRelation,
					}
				},
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			console.log(`✅ Property created in Strapi: ${response.data.data.id} (Blockchain ID: ${propertyData.propertyId})`);
			return response.data.data;
			
		} catch (error) {
			// If duplicate title error, try appending the chain id and retry once
			if (error.response?.data?.error?.message?.toLowerCase?.().includes('already taken')) {
				try {
					const fallbackTitle = `${(propertyData.title || 'Property').trim()} ${propertyData.propertyId}`.trim();
					const resp = await axios.post(
						`${this.strapiConfig.baseURL}/api/properties`,
						{ data: { Title: fallbackTitle, BlockchainPropertyId: propertyData.propertyId, FormattedAddress: propertyData.address || 'Address not available', PricePerNight: parseFloat(propertyData.pricePerNight), Rooms: propertyData.rooms || 1, Bathrooms: propertyData.bathrooms || 1, Size: propertyData.size || 'Not specified', PurchasePrice: 0, Latitude: propertyData.latitude || 0, Longitude: propertyData.longitude || 0, Featured: false, CurrentlyRented: !propertyData.isActive, Stars: propertyData.rating || 5, MaxGuests: propertyData.maxGuests || 2, CleaningFee: propertyData.cleaningFee || 0, AtlasFees: 0.5, Description: propertyData.description || 'Property description not available', Location: propertyData.location || 'Location not available', publishedAt: new Date().toISOString() } },
						{ headers: { 'Authorization': `Bearer ${this.strapiConfig.apiToken}`, 'Content-Type': 'application/json' }, timeout: this.strapiConfig.timeout }
					);
					console.log(`✅ Property created with fallback title in Strapi: ${resp.data.data.id}`);
					return resp.data.data;
				} catch (e2) {
					console.error('❌ Fallback creation failed:', e2.response?.data || e2.message);
				}
			}
			// If duplicate, try to find by ID contains
			if (error.response?.data?.error?.message?.includes('unique')) {
				const existingById = await this.findPropertyByBlockchainId(propertyData.propertyId);
				if (existingById.length > 0) return existingById[0];
			}
			console.error('❌ Error creating property in Strapi:', error.response?.data || error.message);
			throw error;
		}
	}

	/**
	 * Update a property in Strapi
	 */
	async updatePropertyInStrapi(propertyId, updateData) {
		try {
			// First, find the property by blockchain propertyId
			const properties = await this.findPropertyByBlockchainId(propertyId);

			if (properties.length === 0) {
				console.log(`⚠️  Property not found in Strapi: ${propertyId}`);
				return;
			}

			// Strapi v5 uses documentId for API access
			const strapiDocumentId = properties[0].documentId || properties[0].id;

			const response = await axios.put(
				`${this.strapiConfig.baseURL}/api/properties/${strapiDocumentId}`,
				{
					data: updateData
				},
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			console.log(`✅ Property updated in Strapi: ${strapiDocumentId}`);
			return response.data.data;
			
		} catch (error) {
			console.error('❌ Error updating property in Strapi:', error.response?.data || error.message);
			throw error;
		}
	}

	/**
	 * Create a booking in Strapi with idempotency checks
	 */
	async createBookingInStrapi(bookingData) {
		if (!this.autoSync) {
			console.log('⏸️  Auto-sync disabled. Skipping booking create in Strapi.');
			return null;
		}
		try {
			// Check if booking already exists by blockchain bookingId
			const existingBookings = await this.findBookingByBlockchainId(bookingData.bookingId);
			
			if (existingBookings.length > 0) {
				console.log(`✅ Booking already exists in Strapi: ${bookingData.bookingId} (Strapi ID: ${existingBookings[0].id})`);
				return existingBookings[0];
			}
			
			// First, find the property in Strapi
			let properties = await this.findPropertyByBlockchainId(bookingData.propertyId);
			
			// If property is not yet present (e.g., listener missed PropertyListed), create it from chain state now
			if (properties.length === 0) {
				console.log(`⚠️  Property not found for booking: ${bookingData.propertyId}. Attempting to create from chain state...`);
				try {
					const propertyData = await this.contracts.propertyMarketplace.properties(bookingData.propertyId);
					const [propId, tokenAddr, propOwner, pricePerNight, isActive, propertyURI] = propertyData;
					let propertyDetails = {};
					try {
						propertyDetails = await this.ipfsUtils.parsePropertyURI(propertyURI);
					} catch (_) {}
					await this.createPropertyInStrapi({
						propertyId: propId,
						tokenAddress: tokenAddr,
						owner: propOwner,
						pricePerNight: ethers.formatEther(pricePerNight),
						isActive,
						propertyURI,
						...propertyDetails,
					});
					properties = await this.findPropertyByBlockchainId(bookingData.propertyId);
				} catch (e) {
					console.warn(`⚠️  Failed to create property ${bookingData.propertyId} from chain:`, e?.message || e);
				}
			}
			
			if (properties.length === 0) {
				console.log(`⚠️  Property not found for booking after recovery: ${bookingData.propertyId}`);
				return;
			}
			
			const strapiPropertyId = properties[0].id;
			
			// Check if property already has a booking (oneToOne relationship)
			const existingPropertyBookings = await this.findBookingsByPropertyId(strapiPropertyId);
			if (existingPropertyBookings.length > 0) {
				console.log(`⚠️  Property ${bookingData.propertyId} already has a booking: ${existingPropertyBookings[0].id}`);
				return existingPropertyBookings[0];
			}
			
			// Resolve user relation if walletAddress is linked
			let userRelation = {};
			try {
				const user = await this.findUserByWalletAddress(bookingData.guest);
				if (user && user.id) {
					userRelation = { users_permissions_user: user.id };
				}
			} catch (_) {}
			
			// Determine payment method and amount handling
			const paidOffChain = bookingData.paidOffChain || bookingData.paidViaFiat || false;
			const paymentMethod = bookingData.paymentMethod || (paidOffChain ? 'Credit Card' : 'ETH');
			let pricePerNight, totalPaid, platformFeeAmount;

			if (paidOffChain) {
				// External payments - amounts stored as-is
				totalPaid = parseInt(bookingData.totalAmount) || 0;
				platformFeeAmount = parseInt(bookingData.platformFee) || 0;
				pricePerNight = Math.round(totalPaid / bookingData.numberOfNights);
			} else {
				// Direct ETH payments - convert from ETH to micro-ETH for integer storage
				totalPaid = Math.round(parseFloat(bookingData.totalAmount) * 1e6);
				platformFeeAmount = Math.round(parseFloat(bookingData.platformFee) * 1e6);
				pricePerNight = Math.round(totalPaid / bookingData.numberOfNights);
			}

			const response = await axios.post(
				`${this.strapiConfig.baseURL}/api/proeprty-bookings`,
				{
					data: {
						property: strapiPropertyId,
						StartDate: (bookingData.checkInDate instanceof Date ? bookingData.checkInDate : new Date(bookingData.checkInDate)).toISOString().slice(0, 10),
						EndDate: (bookingData.checkOutDate instanceof Date ? bookingData.checkOutDate : new Date(bookingData.checkOutDate)).toISOString().slice(0, 10),
						Guests: bookingData.maxGuests || 2,
						Rooms: 1, // Default
						PriceperNight: pricePerNight,
						NumberOfNights: bookingData.numberOfNights,
						AtlasFee: platformFeeAmount,
						CleaningFee: 0, // Default
						TotalPaid: totalPaid,
						PaidBy: paymentMethod,
						BookingStatus: bookingData.status,
						blockchainBookingId: bookingData.bookingId,
						transactionHash: bookingData.transactionHash || null,
						ipfsUri: bookingData.ipfsUri || null,
						paymentReference: bookingData.paymentReference || null,
						...userRelation,
						publishedAt: new Date().toISOString(),
					}
				},
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			console.log(`✅ Booking created in Strapi: ${response.data.data.id} (Blockchain ID: ${bookingData.bookingId})`);
			return response.data.data;
			
		} catch (error) {
			console.error('❌ Error creating booking in Strapi:', error.response?.data || error.message);
			throw error;
		}
	}

	/**
	 * Update a booking in Strapi
	 */
	async updateBookingInStrapi(bookingId, updateData) {
		try {
			// Find booking by blockchain bookingId
			const bookings = await this.findBookingByBlockchainId(bookingId);
			
			if (bookings.length === 0) {
				console.log(`⚠️  Booking not found in Strapi: ${bookingId}`);
				return;
			}
			
			const strapiBookingId = bookings[0].id;
			
			const response = await axios.put(
				`${this.strapiConfig.baseURL}/api/proeprty-bookings/${strapiBookingId}`,
				{
					data: updateData
				},
				{
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`,
						'Content-Type': 'application/json'
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			console.log(`✅ Booking updated in Strapi: ${strapiBookingId}`);
			return response.data.data;
			
		} catch (error) {
			console.error('❌ Error updating booking in Strapi:', error.response?.data || error.message);
			throw error;
		}
	}

	/**
	 * Find property by title (for duplicate checking)
	 */
	async findPropertyByTitle(title) {
		try {
			const response = await axios.get(
				`${this.strapiConfig.baseURL}/api/properties`,
				{
					params: {
						'filters[Title][$eq]': title
					},
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			return response.data.data || [];
			
		} catch (error) {
			console.error('❌ Error finding property by title in Strapi:', error.response?.data || error.message);
			return [];
		}
	}

	/**
	 * Find bookings by property ID (for duplicate checking)
	 */
	async findBookingsByPropertyId(strapiPropertyId) {
		try {
			const response = await axios.get(
				`${this.strapiConfig.baseURL}/api/proeprty-bookings`,
				{
					params: {
						'filters[property][$eq]': strapiPropertyId
					},
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			return response.data.data || [];
			
		} catch (error) {
			console.error('❌ Error finding bookings by property ID in Strapi:', error.response?.data || error.message);
			return [];
		}
	}

	/**
	 * Enhanced find property by blockchain propertyId
	 */
	async findPropertyByBlockchainId(blockchainPropertyId) {
		try {
			const response = await axios.get(
				`${this.strapiConfig.baseURL}/api/properties`,
				{
					params: {
						'filters[BlockchainPropertyId][$eq]': blockchainPropertyId
					},
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			return response.data.data || [];
			
		} catch (error) {
			console.error('❌ Error finding property in Strapi:', error.response?.data || error.message);
			return [];
		}
	}

	/**
	 * Enhanced find booking by blockchain bookingId
	 * Since we can't store blockchain data directly, we'll use a combination of checks
	 */
	async findBookingByBlockchainId(blockchainBookingId) {
		try {
			// For now, we'll search by booking details that should be unique
			// In production, you might want to add a custom field to Strapi for blockchain booking ID
			const response = await axios.get(
				`${this.strapiConfig.baseURL}/api/proeprty-bookings`,
				{
					params: {
						'populate': '*'
					},
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			
			// Filter by booking details that should match
			const bookings = response.data.data || [];
			// Note: This is a simplified check. In production, you'd want to store blockchain booking ID
			return bookings.filter(booking => {
				// Add your custom logic here to identify the booking
				// For now, return empty array
				return false;
			});
			
		} catch (error) {
			console.error('❌ Error finding booking in Strapi:', error.response?.data || error.message);
		return [];
		}
	}

	/**
	 * Reconcile on-chain state into Strapi (idempotent)
	 * Ensures all on-chain properties exist in Strapi; if userAddress is provided, ensures that user's bookings exist
	 */
	async reconcileChainToStrapi(userAddress) {
		const result = { propertiesEnsured: 0, bookingsEnsured: 0 };
		try {
			// Ensure properties
			const propertyIds = await this.contracts.propertyMarketplace.getAllPropertyIds();
			for (const propId of propertyIds) {
				try {
					const onChain = await this.contracts.propertyMarketplace.properties(propId);
					const [id, tokenAddr, owner, pricePerNight, isActive, propertyURI] = onChain;
					let propertyDetails = {};
					try { propertyDetails = await this.ipfsUtils.parsePropertyURI(propertyURI); } catch (_) {}
					await this.createPropertyInStrapi({
						propertyId: id,
						tokenAddress: tokenAddr,
						owner,
						pricePerNight: ethers.formatEther(pricePerNight),
						isActive,
						propertyURI,
						...propertyDetails,
					});
					result.propertiesEnsured++;
				} catch (e) {
					console.warn(`⚠️  Failed to ensure property ${propId}:`, e?.message || e);
				}
			}
			// Ensure bookings for a given user
			if (userAddress) {
				const bookings = await this.contracts.bookingManager.getGuestBookings(userAddress);
				for (const bid of bookings) {
					try {
						const bookingData = await this.contracts.bookingManager.bookings(bid);
						await this.createBookingInStrapi({
							bookingId: bid.toString(),
							propertyId: bookingData.propertyId,
							guest: bookingData.guest,
							checkInDate: new Date(Number(bookingData.checkInDate) * 1000),
							checkOutDate: new Date(Number(bookingData.checkOutDate) * 1000),
							totalAmount: ethers.formatEther(bookingData.totalAmount),
							platformFee: ethers.formatEther(bookingData.platformFee),
							hostAmount: ethers.formatEther(bookingData.hostAmount),
							status: this.getBookingStatusString(bookingData.status),
							numberOfNights: Math.ceil((Number(bookingData.checkOutDate) - Number(bookingData.checkInDate)) / (24 * 60 * 60))
						});
						result.bookingsEnsured++;
					} catch (e) {
						console.warn(`⚠️  Failed to ensure booking ${bid.toString()}:`, e?.message || e);
					}
				}
			}
			return result;
		} catch (err) {
			console.error('❌ Reconciliation failed:', err?.message || err);
			throw err;
		}
	}

	// ===== UTILITY METHODS =====
	
	static toJSONSafe(value) {
		return JSON.parse(
			JSON.stringify(
				value,
				(key, val) => (typeof val === 'bigint' ? val.toString() : val)
			)
		);
	}

	/**
	 * Convert booking status enum to string
	 */
	getBookingStatusString(status) {
		const statusMap = {
			0: 'Upcoming',
			1: 'Upcoming', 
			2: 'Active',
			3: 'Complete',
			4: 'Upcoming', // Disputed
			5: 'Cancelled',
			6: 'Cancelled', // Refunded
			7: 'Upcoming' // Escalated
		};
		return statusMap[status] || 'Upcoming';
	}

	/**
	 * Stop the event listener
	 */
	stop() {
		this.isRunning = false;
		console.log('🛑 Event listener stopped');
	}

	/**
	 * Clean up old processed events to prevent memory bloat
	 * Call this periodically (e.g., every hour)
	 */
	cleanupProcessedEvents() {
		const maxProcessedEvents = 10000; // Keep last 10k events
		
		if (this.processedEvents.size > maxProcessedEvents) {
			const eventsArray = Array.from(this.processedEvents);
			const eventsToKeep = eventsArray.slice(-maxProcessedEvents);
			
			this.processedEvents.clear();
			eventsToKeep.forEach(event => this.processedEvents.add(event));
			
			console.log(`🧹 Cleaned up processed events. Kept ${eventsToKeep.length} recent events.`);
		}
	}

	/**
	 * Get idempotency statistics for monitoring
	 */
	getIdempotencyStats() {
		return {
			processedEventsCount: this.processedEvents.size,
			processingEventsCount: this.processingEvents.size,
			lastProcessedBlock: this.lastProcessedBlock,
			isRunning: this.isRunning
		};
	}

	/**
	 * Reset idempotency tracking (useful for testing)
	 */
	resetIdempotencyTracking() {
		this.processedEvents.clear();
		this.processingEvents.clear();
		console.log('🔄 Idempotency tracking reset');
	}

	async findUserByWalletAddress(walletAddress) {
		try {
			if (!walletAddress) return null;
			const response = await axios.get(
				`${this.strapiConfig.baseURL}/api/users`,
				{
					params: {
						'filters[walletAddress][$containsi]': walletAddress,
						'pagination[pageSize]': 1,
					},
					headers: {
						'Authorization': `Bearer ${this.strapiConfig.apiToken}`
					},
					timeout: this.strapiConfig.timeout
				}
			);
			const users = Array.isArray(response.data) ? response.data : [];
			return users.length > 0 ? users[0] : null;
		} catch (error) {
			console.error('❌ Error finding user by wallet in Strapi:', error.response?.data || error.message);
			return null;
		}
	}
}

module.exports = EventListener; 