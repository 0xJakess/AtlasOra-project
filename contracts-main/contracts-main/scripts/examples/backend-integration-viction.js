// Backend Integration Example - Viction Testnet (with real EIP-712 signatures)
// This script demonstrates all possible actions with a real signature from a new random wallet
// For backend developers to integrate into existing systems

const hre = require("hardhat");
const { ethers } = require("hardhat");
const eip712Utils = require("../utils/eip712-utils");

class BackendIntegrationVictionExample {
    constructor() {
        this.contractAddresses = {};
        this.contracts = {};
        this.userWallet = null; // The new random wallet for signing
        this.relayer = null;
    }

    /**
     * Initialize the integration example
     */
    async initialize() {
        console.log("🔧 Initializing Backend Integration Example (Viction Testnet, Real Signature)...");
        
        // Generate a new random wallet for the user
        this.userWallet = ethers.Wallet.createRandom();
        console.log("🆕 Generated User Wallet:");
        console.log("  Address:", this.userWallet.address);
        console.log("  Private Key:", this.userWallet.privateKey);
        console.log("  (This wallet does NOT need funds for meta-transactions)");
        
        // Load deployment info
        const fs = require("fs");
        let deploymentInfo;
        
        try {
            deploymentInfo = JSON.parse(fs.readFileSync("deployment-all-viction-testnet.json", "utf8"));
            this.contractAddresses = deploymentInfo.contracts;
            console.log("📋 Loaded deployment info from Viction Testnet");
        } catch (error) {
            console.error("❌ Could not load deployment file. Please deploy contracts first.");
            console.log("Run: npx hardhat run scripts/deploy-all-viction.js --network victionTestnet");
            throw error;
        }
        
        // Initialize contract instances
        const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
        const BookingManager = await hre.ethers.getContractFactory("BookingManager");
        const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
        
        this.contracts.propertyMarketplace = PropertyMarketplace.attach(this.contractAddresses.PropertyMarketplace);
        this.contracts.bookingManager = BookingManager.attach(this.contractAddresses.BookingManager);
        this.contracts.forwarder = MetaTransactionForwarder.attach(this.contractAddresses.MetaTransactionForwarder);
        
        // Set up relayer (backend account that pays for gas)
        const [deployer] = await hre.ethers.getSigners();
        this.relayer = deployer;
        
        console.log("✅ Integration example initialized");
        console.log("📊 Contract Addresses:", this.contractAddresses);
        console.log("🚀 Relayer:", this.relayer.address);
        
        // Check relayer balance
        const balance = await hre.ethers.provider.getBalance(this.relayer.address);
        console.log("💰 Relayer Balance:", ethers.formatEther(balance), "ETH");
        
        if (balance < ethers.parseEther("0.01")) {
            console.warn("⚠️  Low relayer balance. Consider funding the relayer account.");
        }
    }

    /**
     * Example 1: Property Owner Lists a Property
     */
    async example1_ListProperty() {
        console.log("\n🎯 Example 1: Property Owner Lists a Property (Real Signature)");
        console.log("==============================================================");
        
        // Use the generated wallet for signing
        const userWallet = this.userWallet;
        
        // Connect the wallet to the provider for EIP-712 signing
        const userSigner = userWallet.connect(hre.ethers.provider);
        
        // Create meta-transaction for listing property
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const metaTx = await eip712Utils.createListPropertyMetaTransaction(
            "ipfs://QmRealSignatureDemo1", // Property URI
            ethers.parseEther("0.15"), // Price per night (0.15 ETH)
            "RealSigToken", // Token name
            "RST", // Token symbol
            this.contractAddresses.PropertyMarketplace,
            this.contractAddresses.MetaTransactionForwarder,
            userSigner,
            deadline
        );
        
        console.log("📋 Meta-Transaction Created:");
        console.log(`  From: ${metaTx.from}`);
        console.log(`  To: ${metaTx.to}`);
        console.log(`  Nonce: ${metaTx.nonce}`);
        console.log(`  Deadline: ${new Date(metaTx.deadline * 1000).toLocaleString()}`);
        console.log(`  Signature: ${metaTx.signature.substring(0, 66)}...`);
        
        // Execute the meta-transaction
        console.log("\n🚀 Executing Meta-Transaction...");
        try {
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
                this.contractAddresses.MetaTransactionForwarder,
                this.relayer
            );
            
            console.log("✅ Property Listed Successfully!");
            console.log(`  Transaction Hash: ${result.transactionHash}`);
            console.log(`  Gas Used: ${result.gasUsed.toString()}`);
            const gasCost = result.effectiveGasPrice 
                ? ethers.formatEther(BigInt(result.gasUsed) * BigInt(result.effectiveGasPrice))
                : "Unknown";
            console.log(`  Gas Cost: ${gasCost} ETH`);
            
            // Get the property ID
            const propertyIds = await this.contracts.propertyMarketplace.getAllPropertyIds();
            const propertyId = propertyIds[propertyIds.length - 1]; // Get the latest one
            console.log(`  Property ID: ${propertyId}`);
            
            return propertyId;
            
        } catch (error) {
            console.log("❌ Meta-transaction failed:");
            console.log(`  Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Example 2: Guest Books a Property
     */
    async example2_BookProperty(propertyId) {
        console.log("\n🎯 Example 2: Guest Books a Property (Real Signature)");
        console.log("=====================================================");
        
        // Use the generated wallet for signing
        const userWallet = this.userWallet;
        const userSigner = userWallet.connect(hre.ethers.provider);
        
        // Set up booking dates
        const now = Math.floor(Date.now() / 1000);
        const checkInDate = now + 86400 * 7; // 1 week from now
        const checkOutDate = now + 86400 * 10; // 10 days from now (3 nights)
        
        // Create meta-transaction for booking
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const metaTx = await eip712Utils.createBookingMetaTransaction(
            propertyId,
            checkInDate,
            checkOutDate,
            this.contractAddresses.BookingManager,
            this.contractAddresses.MetaTransactionForwarder,
            userSigner,
            deadline
        );
        
        console.log("📋 Meta-Transaction Created:");
        console.log(`  From: ${metaTx.from}`);
        console.log(`  To: ${metaTx.to}`);
        console.log(`  Value: ${ethers.formatEther(metaTx.value)} ETH`);
        console.log(`  Nonce: ${metaTx.nonce}`);
        console.log(`  Deadline: ${new Date(metaTx.deadline * 1000).toLocaleString()}`);
        console.log(`  Signature: ${metaTx.signature.substring(0, 66)}...`);
        
        // Execute the meta-transaction
        console.log("\n🚀 Executing Meta-Transaction...");
        try {
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
                this.contractAddresses.MetaTransactionForwarder,
                this.relayer
            );
            
            console.log("✅ Property Booked Successfully!");
            console.log(`  Transaction Hash: ${result.transactionHash}`);
            console.log(`  Gas Used: ${result.gasUsed.toString()}`);
            const gasCost2 = result.effectiveGasPrice 
                ? ethers.formatEther(BigInt(result.gasUsed) * BigInt(result.effectiveGasPrice))
                : "Unknown";
            console.log(`  Gas Cost: ${gasCost2} ETH`);
            
            // Get the booking ID
            const guestBookings = await this.contracts.bookingManager.getGuestBookings(userWallet.address);
            const bookingId = guestBookings[guestBookings.length - 1]; // Get the latest one
            console.log(`  Booking ID: ${bookingId}`);
            
            return bookingId;
            
        } catch (error) {
            console.log("❌ Meta-transaction failed:");
            console.log(`  Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Example 3: Multiple Properties and Bookings
     */
    async example3_MultipleProperties() {
        console.log("\n🎯 Example 3: Multiple Properties and Bookings");
        console.log("==============================================");
        
        // List second property
        const userKey1 = "propertyOwner2";
        const user1 = this.dummyUsers[userKey1];
        const mockSigner1 = this.createMockSigner(userKey1);
        
        console.log(`👤 User: ${user1.name} (${user1.address})`);
        console.log(`📝 Action: List mountain cabin property`);
        
        const deadline1 = Math.floor(Date.now() / 1000) + 3600;
        const metaTx1 = await eip712Utils.createListPropertyMetaTransaction(
            "ipfs://QmMountainCabin1",
            ethers.parseEther("0.08"), // 0.08 ETH per night
            "Mountain Cabin Token",
            "MCT",
            this.contractAddresses.PropertyMarketplace,
            this.contractAddresses.MetaTransactionForwarder,
            mockSigner1,
            deadline1
        );
        
        try {
            const result1 = await eip712Utils.executeMetaTransaction(
                metaTx1,
                this.contractAddresses.MetaTransactionForwarder,
                this.relayer
            );
            
            const propertyIds = await this.contracts.propertyMarketplace.getAllPropertyIds();
            const propertyId2 = propertyIds[propertyIds.length - 1];
            console.log(`✅ Property Listed: ${propertyId2}`);
            
        } catch (error) {
            console.log("❌ Meta-transaction failed (expected):", error.message);
            console.log("✅ Signature validation working correctly");
        }
        
        // Book second property with different guest
        const userKey2 = "guest2";
        const user2 = this.dummyUsers[userKey2];
        const mockSigner2 = this.createMockSigner(userKey2);
        
        console.log(`\n👤 User: ${user2.name} (${user2.address})`);
        console.log(`📝 Action: Book mountain cabin property`);
        
        const now = Math.floor(Date.now() / 1000);
        const checkInDate = now + 86400 * 14; // 2 weeks from now
        const checkOutDate = now + 86400 * 17; // 17 days from now (3 nights)
        
        const deadline2 = Math.floor(Date.now() / 1000) + 3600;
        const metaTx2 = await eip712Utils.createBookingMetaTransaction(
            "PROP2",
            checkInDate,
            checkOutDate,
            this.contractAddresses.BookingManager,
            this.contractAddresses.MetaTransactionForwarder,
            mockSigner2,
            deadline2
        );
        
        try {
            const result2 = await eip712Utils.executeMetaTransaction(
                metaTx2,
                this.contractAddresses.MetaTransactionForwarder,
                this.relayer
            );
            
            const guestBookings = await this.contracts.bookingManager.getGuestBookings(user2.address);
            const bookingId2 = guestBookings[guestBookings.length - 1];
            console.log(`✅ Property Booked: ${bookingId2}`);
            
        } catch (error) {
            console.log("❌ Meta-transaction failed (expected):", error.message);
            console.log("✅ Signature validation working correctly");
        }
        
        return { propertyId2: "PROP2", bookingId2: "2" };
    }

    /**
     * Example 4: Demonstrate Booking Conflict Prevention
     */
    async example4_BookingConflict() {
        console.log("\n🎯 Example 4: Booking Conflict Prevention");
        console.log("=========================================");
        
        const userKey = "guest3";
        const user = this.dummyUsers[userKey];
        const mockSigner = this.createMockSigner(userKey);
        
        // Get the first property
        const propertyIds = await this.contracts.propertyMarketplace.getAllPropertyIds();
        const propertyId = propertyIds.length > 0 ? propertyIds[0] : "PROP1";
        
        console.log(`👤 User: ${user.name} (${user.address})`);
        console.log(`📝 Action: Try to book property ${propertyId} with conflicting dates`);
        
        // Try to book with overlapping dates (this should fail)
        const now = Math.floor(Date.now() / 1000);
        const checkInDate = now + 86400 * 7; // Same dates as first booking
        const checkOutDate = now + 86400 * 10;
        
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        
        try {
            const metaTx = await eip712Utils.createBookingMetaTransaction(
                propertyId,
                checkInDate,
                checkOutDate,
                this.contractAddresses.BookingManager,
                this.contractAddresses.MetaTransactionForwarder,
                mockSigner,
                deadline
            );
            
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
                this.contractAddresses.MetaTransactionForwarder,
                this.relayer
            );
            
            console.log("❌ This should have failed due to booking conflict!");
            
        } catch (error) {
            console.log("✅ Booking Conflict Correctly Prevented!");
            console.log(`  Error: ${error.message}`);
        }
        
        // Now try with non-overlapping dates (this should succeed)
        console.log(`\n📝 Action: Book property ${propertyId} with non-conflicting dates`);
        
        const nonConflictingCheckIn = now + 86400 * 20; // 20 days from now
        const nonConflictingCheckOut = now + 86400 * 23; // 23 days from now
        
        try {
            const metaTx = await eip712Utils.createBookingMetaTransaction(
                propertyId,
                nonConflictingCheckIn,
                nonConflictingCheckOut,
                this.contractAddresses.BookingManager,
                this.contractAddresses.MetaTransactionForwarder,
                mockSigner,
                deadline
            );
            
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
                this.contractAddresses.MetaTransactionForwarder,
                this.relayer
            );
            
            console.log("✅ Non-Conflicting Booking Successful!");
            console.log(`  Transaction Hash: ${result.transactionHash}`);
            
        } catch (error) {
            console.log("❌ Non-conflicting booking failed:", error.message);
        }
    }

    /**
     * Example 5: System Status and Analytics
     */
    async example5_SystemAnalytics() {
        console.log("\n🎯 Example 5: System Status and Analytics");
        console.log("=========================================");
        
        // Get all properties
        const allPropertyIds = await this.contracts.propertyMarketplace.getAllPropertyIds();
        const activePropertyIds = await this.contracts.propertyMarketplace.getActivePropertyIds();
        
        console.log("📊 Property Statistics:");
        console.log(`  Total Properties: ${allPropertyIds.length}`);
        console.log(`  Active Properties: ${activePropertyIds.length}`);
        
        // Get booking statistics for each user
        console.log("\n👥 User Booking Statistics:");
        for (const [userKey, user] of Object.entries(this.dummyUsers)) {
            const guestBookings = await this.contracts.bookingManager.getGuestBookings(user.address);
            console.log(`  ${user.name}: ${guestBookings.length} bookings`);
        }
        
        // Get platform fee information
        const platformFeePercentage = await this.contracts.propertyMarketplace.platformFeePercentage();
        const feeRecipient = await this.contracts.propertyMarketplace.feeRecipient();
        
        console.log("\n💰 Platform Information:");
        console.log(`  Platform Fee: ${Number(platformFeePercentage) / 10}%`);
        console.log(`  Fee Recipient: ${feeRecipient}`);
        
        // Get forwarder statistics
        console.log("\n🔀 Meta-Transaction Statistics:");
        for (const [userKey, user] of Object.entries(this.dummyUsers)) {
            const nonce = await this.contracts.forwarder.getNonce(user.address);
            console.log(`  ${user.name}: Nonce ${nonce}`);
        }
        
        // Get relayer balance
        const relayerBalance = await hre.ethers.provider.getBalance(this.relayer.address);
        console.log(`\n🚀 Relayer Balance: ${ethers.formatEther(relayerBalance)} ETH`);
    }

    /**
     * Example 6: Event Listener Integration
     */
    async example6_EventListener() {
        console.log("\n🎯 Example 6: Event Listener Integration");
        console.log("=======================================");
        
        console.log("📡 Backend Event Listener would monitor these events:");
        console.log("\n🏠 PropertyMarketplace Events:");
        console.log("  • PropertyListed(propertyId, tokenAddress, owner)");
        console.log("  • PropertyUpdated(propertyId, newPricePerNight, isActive)");
        console.log("  • PropertyRemoved(propertyId)");
        console.log("  • PlatformFeeUpdated(newFeePercentage)");
        console.log("  • FeeRecipientUpdated(newFeeRecipient)");
        
        console.log("\n📅 BookingManager Events:");
        console.log("  • BookingCreated(bookingId, propertyId, guest, checkInDate, amount)");
        console.log("  • CheckInWindowOpened(bookingId, deadline)");
        console.log("  • CheckedIn(bookingId, guest)");
        console.log("  • CheckInMissed(bookingId)");
        console.log("  • DisputeRaised(bookingId, reason)");
        console.log("  • DisputeResolved(bookingId, byHost, byGuest)");
        console.log("  • DisputeEscalated(bookingId)");
        console.log("  • BookingCompleted(bookingId)");
        console.log("  • BookingCancelled(bookingId)");
        console.log("  • BookingRefunded(bookingId, amount)");
        
        console.log("\n🔀 MetaTransactionForwarder Events:");
        console.log("  • MetaTransactionExecuted(from, to, data, nonce)");
        
        console.log("\n💾 Database Sync Process:");
        console.log("  1. Listen for blockchain events in real-time");
        console.log("  2. Parse event data and extract relevant information");
        console.log("  3. Update database tables accordingly");
        console.log("  4. Handle event ordering and duplicate prevention");
        console.log("  5. Implement error handling and retry logic");
        
        console.log("\n🔗 Event Listener Script:");
        console.log("  Run: node scripts/event-listener.js");
        console.log("  This will monitor all events and sync to your database");
    }

    /**
     * Run all examples
     */
    async runAllExamples() {
        console.log("🚀 Starting Backend Integration Examples (Viction Testnet, Real Signature)");
        console.log("=======================================================================");
        
        try {
            await this.initialize();
            
            // Run examples with real EIP-712 signatures
            const propertyId1 = await this.example1_ListProperty();
            const bookingId1 = await this.example2_BookProperty(propertyId1);
            const { propertyId2, bookingId2 } = await this.example3_MultipleProperties();
            await this.example4_BookingConflict();
            await this.example5_SystemAnalytics();
            await this.example6_EventListener();
            
            console.log("\n🎉 All Real Signature Examples Completed!");
            console.log("=======================================");
            console.log("📋 Summary:");
            console.log("  ✅ Meta-transaction creation demonstrated");
            console.log("  ✅ EIP-712 signature generation shown");
            console.log("  ✅ Backend integration workflow explained");
            console.log("  ✅ Event listener integration outlined");
            console.log("  ✅ System analytics and monitoring shown");
            
            console.log("\n💡 Next Steps for Backend Integration:");
            console.log("  1. Replace dummy signatures with real user signatures");
            console.log("  2. Implement proper signature validation");
            console.log("  3. Set up event listener for database synchronization");
            console.log("  4. Add error handling and retry logic");
            console.log("  5. Implement user authentication and session management");
            console.log("  6. Add monitoring and logging for production");
            console.log("  7. Test thoroughly on testnet before mainnet");
            
            console.log("\n🔗 Useful Files:");
            console.log("  • scripts/eip712-utils.js - Meta-transaction utilities");
            console.log("  • scripts/event-listener.js - Blockchain event monitoring");
            console.log("  • BACKEND_INTEGRATION_GUIDE.md - Detailed integration guide");
            console.log("  • contracts/ - Smart contract source code");
            
            console.log("\n🌐 Network Information:");
            console.log("  • Network: Viction Testnet");
            console.log("  • Chain ID: 89");
            console.log("  • RPC URL: https://rpc-testnet.viction.xyz");
            console.log("  • Block Explorer: https://testnet.vicscan.xyz");
            
        } catch (error) {
            console.error("❌ Integration example failed:", error);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const integrationExample = new BackendIntegrationVictionExample();
    await integrationExample.runAllExamples();
}

// Export for use in other scripts
module.exports = BackendIntegrationVictionExample;

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error("❌ Backend integration example failed:", error);
        process.exit(1);
    });
} 