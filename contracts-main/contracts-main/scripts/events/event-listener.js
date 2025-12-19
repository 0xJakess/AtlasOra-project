// Event Listener for Blockchain to Database Sync
const hre = require("hardhat");
const { ethers } = require("hardhat");

class EventListener {
	constructor() {
		this.provider = hre.ethers.provider;
		this.isRunning = false;
		this.lastProcessedBlock = 0;
		this.contracts = {};
		this.eventHandlers = new Map();
	}

	/**
	 * Initialize contracts and event handlers
	 */
	async initialize(contractAddresses) {
		console.log("🔧 Initializing Event Listener...");
		
		// Initialize contract instances
		const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
		const BookingManager = await hre.ethers.getContractFactory("BookingManager");
		const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
		
		this.contracts.propertyMarketplace = PropertyMarketplace.attach(contractAddresses.PropertyMarketplace);
		this.contracts.bookingManager = BookingManager.attach(contractAddresses.BookingManager);
		this.contracts.forwarder = MetaTransactionForwarder.attach(contractAddresses.MetaTransactionForwarder);
		
		console.log("✅ Contracts initialized");
		
		// Set up event handlers
		this.setupEventHandlers();
		
		// Get current block number
		this.lastProcessedBlock = await this.provider.getBlockNumber();
		console.log(`📦 Starting from block: ${this.lastProcessedBlock}`);
	}

	/**
	 * Set up event handlers for all contracts
	 */
	setupEventHandlers() {
		// PropertyMarketplace Events
		this.eventHandlers.set("PropertyListed", this.handlePropertyListed.bind(this));
		this.eventHandlers.set("PropertyUpdated", this.handlePropertyUpdated.bind(this));
		this.eventHandlers.set("PropertyRemoved", this.handlePropertyRemoved.bind(this));
		this.eventHandlers.set("PlatformFeeUpdated", this.handlePlatformFeeUpdated.bind(this));
		this.eventHandlers.set("FeeRecipientUpdated", this.handleFeeRecipientUpdated.bind(this));
		
		// BookingManager Events
		this.eventHandlers.set("BookingCreated", this.handleBookingCreated.bind(this));
		this.eventHandlers.set("CheckInWindowOpened", this.handleCheckInWindowOpened.bind(this));
		this.eventHandlers.set("CheckedIn", this.handleCheckedIn.bind(this));
		this.eventHandlers.set("CheckInMissed", this.handleCheckInMissed.bind(this));
		this.eventHandlers.set("DisputeRaised", this.handleDisputeRaised.bind(this));
		this.eventHandlers.set("DisputeResolved", this.handleDisputeResolved.bind(this));
		this.eventHandlers.set("DisputeEscalated", this.handleDisputeEscalated.bind(this));
		this.eventHandlers.set("BookingCompleted", this.handleBookingCompleted.bind(this));
		this.eventHandlers.set("BookingCancelled", this.handleBookingCancelled.bind(this));
		this.eventHandlers.set("BookingRefunded", this.handleBookingRefunded.bind(this));
		
		// MetaTransactionForwarder Events
		this.eventHandlers.set("MetaTransactionExecuted", this.handleMetaTransactionExecuted.bind(this));
		
		console.log("✅ Event handlers configured");
	}

	/**
	 * Start listening to events
	 */
	async start() {
		if (this.isRunning) {
			console.log("⚠️  Event listener is already running");
			return;
		}

		this.isRunning = true;
		console.log("🚀 Starting event listener...");

		// Set up event listeners for all contracts
		this.setupContractListeners();

		// Start polling for new blocks
		this.startPolling();
	}

	/**
	 * Set up listeners for all contract events
	 */
	setupContractListeners() {
		// PropertyMarketplace events
		this.contracts.propertyMarketplace.on("PropertyListed", (...args) => {
			this.handleEvent("PropertyListed", args);
		});

		this.contracts.propertyMarketplace.on("PropertyUpdated", (...args) => {
			this.handleEvent("PropertyUpdated", args);
		});

		this.contracts.propertyMarketplace.on("PropertyRemoved", (...args) => {
			this.handleEvent("PropertyRemoved", args);
		});

		// BookingManager events
		this.contracts.bookingManager.on("BookingCreated", (...args) => {
			this.handleEvent("BookingCreated", args);
		});

		this.contracts.bookingManager.on("CheckInWindowOpened", (...args) => {
			this.handleEvent("CheckInWindowOpened", args);
		});

		this.contracts.bookingManager.on("CheckedIn", (...args) => {
			this.handleEvent("CheckedIn", args);
		});

		this.contracts.bookingManager.on("CheckInMissed", (...args) => {
			this.handleEvent("CheckInMissed", args);
		});

		this.contracts.bookingManager.on("DisputeRaised", (...args) => {
			this.handleEvent("DisputeRaised", args);
		});

		this.contracts.bookingManager.on("DisputeResolved", (...args) => {
			this.handleEvent("DisputeResolved", args);
		});

		this.contracts.bookingManager.on("DisputeEscalated", (...args) => {
			this.handleEvent("DisputeEscalated", args);
		});

		this.contracts.bookingManager.on("BookingCompleted", (...args) => {
			this.handleEvent("BookingCompleted", args);
		});

		this.contracts.bookingManager.on("BookingCancelled", (...args) => {
			this.handleEvent("BookingCancelled", args);
		});

		this.contracts.bookingManager.on("BookingRefunded", (...args) => {
			this.handleEvent("BookingRefunded", args);
		});

		// MetaTransactionForwarder events
		this.contracts.forwarder.on("MetaTransactionExecuted", (...args) => {
			this.handleEvent("MetaTransactionExecuted", args);
		});

		console.log("✅ Contract event listeners set up");
	}

	/**
	 * Start polling for new blocks and process historical events
	 */
	async startPolling() {
		console.log("🔄 Starting block polling...");
		
		// Process historical events first
		await this.processHistoricalEvents();
		
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
		console.log("📚 Processing historical events...");
		
		const currentBlock = await this.provider.getBlockNumber();
		const fromBlock = Math.max(0, this.lastProcessedBlock - 1000); // Last 1000 blocks
		
		try {
			// Get all events from all contracts
			const events = await this.getAllEvents(fromBlock, currentBlock);
			
			console.log(`📊 Found ${events.length} historical events`);
			
			// Process events in order
			for (const event of events) {
				await this.processEvent(event);
			}
			
			this.lastProcessedBlock = currentBlock;
			console.log("✅ Historical events processed");
			
		} catch (error) {
			console.error("❌ Error processing historical events:", error);
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
			}
		} catch (error) {
			console.error("❌ Error processing new blocks:", error);
		}
	}

	/**
	 * Get all events from all contracts
	 */
	async getAllEvents(fromBlock, toBlock) {
		const events = [];
		
		try {
			// Get events from PropertyMarketplace
			const propertyEvents = await this.contracts.propertyMarketplace.queryFilter("*", fromBlock, toBlock);
			events.push(...propertyEvents);
			
			// Get events from BookingManager
			const bookingEvents = await this.contracts.bookingManager.queryFilter("*", fromBlock, toBlock);
			events.push(...bookingEvents);
			
			// Get events from MetaTransactionForwarder
			const forwarderEvents = await this.contracts.forwarder.queryFilter("*", fromBlock, toBlock);
			events.push(...forwarderEvents);
			
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
	 * Handle incoming event
	 */
	async handleEvent(eventName, args) {
		const event = {
			name: eventName,
			args: args,
			timestamp: Date.now()
		};
		
		await this.processEvent(event);
	}

	/**
	 * Process a single event
	 */
	async processEvent(event) {
		// Handle both custom event objects and ethers event objects
		let eventName, eventArgs, eventTimestamp;
		
		if (event.name) {
			// Custom event object
			eventName = event.name;
			eventArgs = event.args;
			eventTimestamp = event.timestamp;
		} else if (event.eventName) {
			// Ethers event object
			eventName = event.eventName;
			eventArgs = event.args;
			eventTimestamp = Date.now();
		} else {
			console.log(`⚠️  Unknown event format:`, event);
			return;
		}
		
		const handler = this.eventHandlers.get(eventName);
		
		if (handler) {
			try {
				await handler({
					name: eventName,
					args: eventArgs,
					timestamp: eventTimestamp
				});
			} catch (error) {
				console.error(`❌ Error handling event ${eventName}:`, error);
			}
		} else {
			console.log(`⚠️  No handler for event: ${eventName}`);
		}
	}

	/**
	 * Stop the event listener
	 */
	stop() {
		this.isRunning = false;
		console.log("🛑 Event listener stopped");
	}

	// ===== EVENT HANDLERS =====
	
	async handlePropertyListed(event) {
		const [propertyId, tokenAddress, owner] = event.args;
		console.log(`🏠 Property Listed: ${propertyId} by ${owner} (Token: ${tokenAddress})`);
		
		try {
			// Fetch complete property data from blockchain
			const propertyData = await this.contracts.propertyMarketplace.properties(propertyId);
			const [propId, tokenAddr, propOwner, pricePerNight, isActive, propertyURI] = propertyData;
			
			// Get token details
			const PropertyToken = await hre.ethers.getContractFactory("PropertyToken");
			const tokenContract = PropertyToken.attach(tokenAddress);
			const tokenName = await tokenContract.name();
			const tokenSymbol = await tokenContract.symbol();
			
			await this.syncToDatabase("PropertyListed", {
				propertyId,
				tokenAddress,
				owner,
				pricePerNight: pricePerNight.toString(),
				isActive,
				propertyURI, // IPFS URL with property details
				tokenName,
				tokenSymbol,
				timestamp: event.timestamp || Date.now()
			});
			
			console.log(`📊 Property Details: Price: ${hre.ethers.formatEther(pricePerNight)} ETH/night, URI: ${propertyURI}`);
			
		} catch (error) {
			console.error(`❌ Error fetching property data for ${propertyId}:`, error.message);
			// Fallback to basic event data
			await this.syncToDatabase("PropertyListed", {
				propertyId,
				tokenAddress,
				owner,
				timestamp: event.timestamp || Date.now()
			});
		}
	}

	async handlePropertyUpdated(event) {
		const [propertyId, newPricePerNight, isActive] = event.args;
		console.log(`📝 Property Updated: ${propertyId} - Price: ${hre.ethers.formatEther(newPricePerNight)} ETH/night, Active: ${isActive}`);
		
		try {
			// Fetch current property data to get complete state
			const propertyData = await this.contracts.propertyMarketplace.properties(propertyId);
			const [propId, tokenAddr, owner, pricePerNight, propIsActive, propertyURI] = propertyData;
			
			await this.syncToDatabase("PropertyUpdated", {
				propertyId,
				oldPricePerNight: pricePerNight.toString(),
				newPricePerNight: newPricePerNight.toString(),
				oldIsActive: propIsActive,
				newIsActive: isActive,
				owner,
				propertyURI,
				tokenAddress: tokenAddr,
				timestamp: event.timestamp || Date.now()
			});
			
		} catch (error) {
			console.error(`❌ Error fetching property data for update ${propertyId}:`, error.message);
			// Fallback to basic event data
			await this.syncToDatabase("PropertyUpdated", {
				propertyId,
				newPricePerNight: newPricePerNight.toString(),
				isActive,
				timestamp: event.timestamp || Date.now()
			});
		}
	}

	async handlePropertyRemoved(event) {
		const [propertyId] = event.args;
		console.log(`🗑️  Property Removed: ${propertyId}`);
		
		await this.syncToDatabase("PropertyRemoved", {
			propertyId,
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleBookingCreated(event) {
		const [bookingId, propertyId, guest, checkInDate, amount] = event.args;
		console.log(`📅 Booking Created: ${bookingId} for ${propertyId} by ${guest} - Amount: ${hre.ethers.formatEther(amount)} ETH`);
		
		try {
			// Fetch complete booking data from blockchain
			const bookingData = await this.contracts.bookingManager.bookings(bookingId);
			const {
				bookingId: bId,
				propertyId: pId,
				guest: guestAddr,
				checkInDate: checkIn,
				checkOutDate: checkOut,
				totalAmount,
				platformFee,
				hostAmount,
				status,
				checkInWindowStart,
				checkInDeadline,
				disputeDeadline,
				isCheckInComplete,
				isResolvedByHost,
				isResolvedByGuest,
				disputeReason
			} = bookingData;
			
			// Fetch property details
			const propertyData = await this.contracts.propertyMarketplace.properties(propertyId);
			const [propId, tokenAddr, owner, pricePerNight, isActive, propertyURI] = propertyData;
			
			await this.syncToDatabase("BookingCreated", {
				bookingId: bookingId.toString(),
				propertyId,
				guest,
				checkInDate: checkIn.toString(),
				checkOutDate: checkOut.toString(),
				totalAmount: totalAmount.toString(),
				platformFee: platformFee.toString(),
				hostAmount: hostAmount.toString(),
				status: this.getBookingStatusString(status),
				checkInWindowStart: checkInWindowStart.toString(),
				checkInDeadline: checkInDeadline.toString(),
				disputeDeadline: disputeDeadline.toString(),
				isCheckInComplete,
				isResolvedByHost,
				isResolvedByGuest,
				disputeReason,
				// Property details
				propertyOwner: owner,
				propertyPricePerNight: pricePerNight.toString(),
				propertyURI,
				propertyTokenAddress: tokenAddr,
				// Calculated fields
				numberOfNights: Math.ceil((Number(checkOut) - Number(checkIn)) / (24 * 60 * 60)),
				timestamp: event.timestamp || Date.now()
			});
			
			console.log(`📊 Booking Details: ${this.getBookingStatusString(status)}, ${Math.ceil((Number(checkOut) - Number(checkIn)) / (24 * 60 * 60))} nights, Check-in: ${new Date(Number(checkIn) * 1000).toLocaleDateString()}`);
			
		} catch (error) {
			console.error(`❌ Error fetching booking data for ${bookingId}:`, error.message);
			// Fallback to basic event data
			await this.syncToDatabase("BookingCreated", {
				bookingId: bookingId.toString(),
				propertyId,
				guest,
				checkInDate: checkInDate.toString(),
				amount: amount.toString(),
				timestamp: event.timestamp || Date.now()
			});
		}
	}

	async handleCheckInWindowOpened(event) {
		const [bookingId, deadline] = event.args;
		console.log(`⏰ Check-in Window Opened: ${bookingId} - Deadline: ${new Date(deadline * 1000).toISOString()}`);
		
		try {
			// Fetch complete booking data
			const bookingData = await this.contracts.bookingManager.bookings(bookingId);
			const { propertyId, guest, checkInDate, checkOutDate, totalAmount, status } = bookingData;
			
			await this.syncToDatabase("CheckInWindowOpened", {
				bookingId: bookingId.toString(),
				propertyId,
				guest,
				checkInDate: checkInDate.toString(),
				checkOutDate: checkOutDate.toString(),
				totalAmount: totalAmount.toString(),
				status: this.getBookingStatusString(status),
				deadline: deadline.toString(),
				checkInWindowStart: bookingData.checkInWindowStart.toString(),
				timestamp: event.timestamp || Date.now()
			});
			
		} catch (error) {
			console.error(`❌ Error fetching booking data for check-in window ${bookingId}:`, error.message);
			// Fallback to basic event data
			await this.syncToDatabase("CheckInWindowOpened", {
				bookingId: bookingId.toString(),
				deadline: deadline.toString(),
				timestamp: event.timestamp || Date.now()
			});
		}
	}

	async handleCheckedIn(event) {
		const [bookingId, guest] = event.args;
		console.log(`✅ Checked In: ${bookingId} by ${guest}`);
		
		try {
			// Fetch complete booking data
			const bookingData = await this.contracts.bookingManager.bookings(bookingId);
			const { propertyId, checkInDate, checkOutDate, totalAmount, status, isCheckInComplete } = bookingData;
			
			await this.syncToDatabase("CheckedIn", {
				bookingId: bookingId.toString(),
				propertyId,
				guest,
				checkInDate: checkInDate.toString(),
				checkOutDate: checkOutDate.toString(),
				totalAmount: totalAmount.toString(),
				status: this.getBookingStatusString(status),
				isCheckInComplete,
				checkInWindowStart: bookingData.checkInWindowStart.toString(),
				checkInDeadline: bookingData.checkInDeadline.toString(),
				timestamp: event.timestamp || Date.now()
			});
			
		} catch (error) {
			console.error(`❌ Error fetching booking data for check-in ${bookingId}:`, error.message);
			// Fallback to basic event data
			await this.syncToDatabase("CheckedIn", {
				bookingId: bookingId.toString(),
				guest,
				timestamp: event.timestamp || Date.now()
			});
		}
	}

	async handleCheckInMissed(event) {
		const [bookingId] = event.args;
		console.log(`❌ Check-in Missed: ${bookingId}`);
		
		await this.syncToDatabase("CheckInMissed", {
			bookingId: bookingId.toString(),
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleDisputeRaised(event) {
		const [bookingId, reason] = event.args;
		console.log(`⚠️  Dispute Raised: ${bookingId} - Reason: ${reason}`);
		
		await this.syncToDatabase("DisputeRaised", {
			bookingId: bookingId.toString(),
			reason,
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleDisputeResolved(event) {
		const [bookingId, byHost, byGuest] = event.args;
		console.log(`🤝 Dispute Resolved: ${bookingId} - Host: ${byHost}, Guest: ${byGuest}`);
		
		await this.syncToDatabase("DisputeResolved", {
			bookingId: bookingId.toString(),
			byHost,
			byGuest,
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleDisputeEscalated(event) {
		const [bookingId] = event.args;
		console.log(`🚨 Dispute Escalated: ${bookingId}`);
		
		await this.syncToDatabase("DisputeEscalated", {
			bookingId: bookingId.toString(),
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleBookingCompleted(event) {
		const [bookingId] = event.args;
		console.log(`🎉 Booking Completed: ${bookingId}`);
		
		await this.syncToDatabase("BookingCompleted", {
			bookingId: bookingId.toString(),
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleBookingCancelled(event) {
		const [bookingId] = event.args;
		console.log(`❌ Booking Cancelled: ${bookingId}`);
		
		await this.syncToDatabase("BookingCancelled", {
			bookingId: bookingId.toString(),
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleBookingRefunded(event) {
		const [bookingId, amount] = event.args;
		console.log(`💰 Booking Refunded: ${bookingId} - Amount: ${ethers.formatEther(amount)} ETH`);
		
		await this.syncToDatabase("BookingRefunded", {
			bookingId: bookingId.toString(),
			amount: amount.toString(),
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleMetaTransactionExecuted(event) {
		const [from, to, data, nonce] = event.args;
		console.log(`🔀 Meta-Transaction Executed: ${from} -> ${to} (Nonce: ${nonce})`);
		
		await this.syncToDatabase("MetaTransactionExecuted", {
			from,
			to,
			data,
			nonce: nonce.toString(),
			timestamp: event.timestamp || Date.now()
		});
	}

	async handlePlatformFeeUpdated(event) {
		const [newFeePercentage] = event.args;
		console.log(`💰 Platform Fee Updated: ${newFeePercentage / 10}%`);
		
		await this.syncToDatabase("PlatformFeeUpdated", {
			newFeePercentage: newFeePercentage.toString(),
			timestamp: event.timestamp || Date.now()
		});
	}

	async handleFeeRecipientUpdated(event) {
		const [newFeeRecipient] = event.args;
		console.log(`👤 Fee Recipient Updated: ${newFeeRecipient}`);
		
		await this.syncToDatabase("FeeRecipientUpdated", {
			newFeeRecipient,
			timestamp: event.timestamp || Date.now()
		});
	}

	/**
	 * Convert booking status enum to string
	 */
	getBookingStatusString(status) {
		const statusMap = {
			0: "Active",
			1: "CheckInReady", 
			2: "CheckedIn",
			3: "Completed",
			4: "Disputed",
			5: "Cancelled",
			6: "Refunded",
			7: "EscalatedToAdmin"
		};
		return statusMap[status] || "Unknown";
	}

	/**
	 * Sync event data to database
	 * TODO: Implement your database sync logic here
	 */
	async syncToDatabase(eventType, data) {
		// This is where you would integrate with your database
		// Example implementations:
		
		// For MongoDB:
		// await db.events.insertOne({
		//     eventType,
		//     data,
		//     createdAt: new Date()
		// });
		
		// For PostgreSQL:
		// await db.query(
		//     'INSERT INTO blockchain_events (event_type, event_data, created_at) VALUES ($1, $2, $3)',
		//     [eventType, JSON.stringify(data), new Date()]
		// );
		
		// For MySQL:
		// await db.query(
		//     'INSERT INTO blockchain_events (event_type, event_data, created_at) VALUES (?, ?, ?)',
		//     [eventType, JSON.stringify(data), new Date()]
		// );
		
		// For now, just log the data
		console.log(`💾 Syncing to database: ${eventType}`);
		console.log(`📊 Data structure:`, JSON.stringify(data, null, 2));
		
		// Example of how to handle different event types in your database:
		switch (eventType) {
			case "PropertyListed":
				// Insert into properties table
				// await db.query('INSERT INTO properties (property_id, token_address, owner, price_per_night, is_active, property_uri, token_name, token_symbol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
				//     [data.propertyId, data.tokenAddress, data.owner, data.pricePerNight, data.isActive, data.propertyURI, data.tokenName, data.tokenSymbol]);
				break;
				
			case "BookingCreated":
				// Insert into bookings table
				// await db.query('INSERT INTO bookings (booking_id, property_id, guest, check_in_date, check_out_date, total_amount, platform_fee, host_amount, status, property_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
				//     [data.bookingId, data.propertyId, data.guest, data.checkInDate, data.checkOutDate, data.totalAmount, data.platformFee, data.hostAmount, data.status, data.propertyURI]);
				break;
				
			case "PropertyUpdated":
				// Update properties table
				// await db.query('UPDATE properties SET price_per_night = ?, is_active = ? WHERE property_id = ?',
				//     [data.newPricePerNight, data.newIsActive, data.propertyId]);
				break;
				
			default:
				// Generic event logging
				// await db.query('INSERT INTO blockchain_events (event_type, event_data, created_at) VALUES (?, ?, ?)',
				//     [eventType, JSON.stringify(data), new Date()]);
		}
	}
}

// Main execution
async function main() {
	console.log("=== Blockchain Event Listener ===");
	
	// Load deployment info
	const fs = require("fs");
	let deploymentInfo;
	
	try {
		deploymentInfo = JSON.parse(fs.readFileSync("deployment-all-viction-testnet.json", "utf8"));
		console.log("📋 Loaded deployment info");
	} catch (error) {
		console.error("❌ Could not load deployment file. Please deploy contracts first.");
		process.exit(1);
	}
	
	// Initialize event listener
	const eventListener = new EventListener();
	await eventListener.initialize(deploymentInfo.contracts);
	
	// Start listening
	await eventListener.start();
	
	// Keep the process running
	console.log("🔄 Event listener is running. Press Ctrl+C to stop.");
	
	// Handle graceful shutdown
	process.on('SIGINT', () => {
		console.log("\n🛑 Shutting down event listener...");
		eventListener.stop();
		process.exit(0);
	});
}

// Export for use in other scripts
module.exports = EventListener;

// Run if called directly
if (require.main === module) {
	main().catch((error) => {
		console.error("❌ Event listener failed:", error);
		process.exit(1);
	});
} 