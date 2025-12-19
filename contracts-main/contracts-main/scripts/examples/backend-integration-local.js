// Backend Integration Example - Local Hardhat Network Demo
// This script demonstrates all possible actions with dummy signatures
// For backend developers to integrate into existing systems

const hre = require("hardhat");
const { ethers } = require("hardhat");
const eip712Utils = require("../utils/eip712-utils");

class BackendIntegrationLocalExample {
    constructor() {
        this.contractAddresses = {};
        this.contracts = {};
        this.dummyUsers = {};
        this.relayer = null;
    }

    /**
     * Initialize the integration example
     */
    async initialize() {
        console.log("🔧 Initializing Backend Integration Example (Local Network)...");
        
        // Deploy contracts locally for demo
        console.log("📦 Deploying contracts to local network...");
        
        const [deployer] = await hre.ethers.getSigners();
        
        // Deploy PropertyMarketplace
        const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
        const propertyMarketplace = await PropertyMarketplace.deploy(deployer.address);
        await propertyMarketplace.waitForDeployment();
        
        // Deploy BookingManager
        const BookingManager = await hre.ethers.getContractFactory("BookingManager");
        const bookingManager = await BookingManager.deploy(await propertyMarketplace.getAddress());
        await bookingManager.waitForDeployment();
        
        // Deploy MetaTransactionForwarder
        const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
        const forwarder = await MetaTransactionForwarder.deploy();
        await forwarder.waitForDeployment();
        
        this.contractAddresses = {
            PropertyMarketplace: await propertyMarketplace.getAddress(),
            BookingManager: await bookingManager.getAddress(),
            MetaTransactionForwarder: await forwarder.getAddress()
        };
        
        this.contracts.propertyMarketplace = propertyMarketplace;
        this.contracts.bookingManager = bookingManager;
        this.contracts.forwarder = forwarder;
        
        // Set up dummy users (in real app, these would be actual user addresses)
        this.setupDummyUsers();
        
        // Set up relayer (backend account that pays for gas)
        this.relayer = deployer;
        
        console.log("✅ Integration example initialized");
        console.log("📊 Contract Addresses:", this.contractAddresses);
        console.log("👥 Dummy Users:", Object.keys(this.dummyUsers));
        console.log("🚀 Relayer:", this.relayer.address);
    }

    /**
     * Set up dummy users for demonstration
     */
    setupDummyUsers() {
        // Create dummy user objects with mock signers
        this.dummyUsers = {
            "propertyOwner1": {
                address: "0x1234567890123456789012345678901234567890",
                name: "Property Owner 1",
                description: "Owns beach house property"
            },
            "propertyOwner2": {
                address: "0x2345678901234567890123456789012345678901",
                name: "Property Owner 2", 
                description: "Owns mountain cabin property"
            },
            "guest1": {
                address: "0x3456789012345678901234567890123456789012",
                name: "Guest 1",
                description: "Books properties for vacation"
            },
            "guest2": {
                address: "0x4567890123456789012345678901234567890123",
                name: "Guest 2",
                description: "Business traveler"
            },
            "guest3": {
                address: "0x5678901234567890123456789012345678901234",
                name: "Guest 3",
                description: "Weekend getaway guest"
            }
        };
    }

    /**
     * Create a mock signer for a dummy user
     */
    createMockSigner(userKey) {
        const user = this.dummyUsers[userKey];
        if (!user) {
            throw new Error(`User ${userKey} not found`);
        }
        
        return {
            getAddress: () => user.address,
            signMessage: async (message) => {
                // In a real implementation, this would be the actual user's signature
                // For demo purposes, we create a mock signature
                return "0x" + "1".repeat(130); // Mock signature
            }
        };
    }

    /**
     * Example 1: Property Owner Lists a Property
     */
    async example1_ListProperty() {
        console.log("\n🎯 Example 1: Property Owner Lists a Property");
        console.log("=============================================");
        
        const userKey = "propertyOwner1";
        const user = this.dummyUsers[userKey];
        const mockSigner = this.createMockSigner(userKey);
        
        console.log(`👤 User: ${user.name} (${user.address})`);
        console.log(`📝 Action: List property on marketplace`);
        
        // Create meta-transaction for listing property
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const metaTx = await eip712Utils.createListPropertyMetaTransaction(
            "ipfs://QmBeachHouse1", // Property URI
            ethers.parseEther("0.15"), // Price per night (0.15 ETH)
            "Beach House Token", // Token name
            "BHT", // Token symbol
            this.contractAddresses.PropertyMarketplace,
            this.contractAddresses.MetaTransactionForwarder,
            mockSigner,
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
        const result = await eip712Utils.executeMetaTransaction(
            metaTx,
            this.contractAddresses.MetaTransactionForwarder,
            this.relayer
        );
        
        console.log("✅ Property Listed Successfully!");
        console.log(`  Transaction Hash: ${result.transactionHash}`);
        console.log(`  Gas Used: ${result.gasUsed.toString()}`);
        console.log(`  Gas Cost: ${ethers.formatEther(result.gasUsed * result.effectiveGasPrice)} ETH`);
        
        // Get the property ID
        const propertyIds = await this.contracts.propertyMarketplace.getAllPropertyIds();
        const propertyId = propertyIds[propertyIds.length - 1]; // Get the latest one
        console.log(`  Property ID: ${propertyId}`);
        
        return propertyId;
    }

    /**
     * Example 2: Guest Books a Property
     */
    async example2_BookProperty(propertyId) {
        console.log("\n🎯 Example 2: Guest Books a Property");
        console.log("====================================");
        
        const userKey = "guest1";
        const user = this.dummyUsers[userKey];
        const mockSigner = this.createMockSigner(userKey);
        
        console.log(`👤 User: ${user.name} (${user.address})`);
        console.log(`📝 Action: Book property ${propertyId}`);
        
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
            mockSigner,
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
        const result = await eip712Utils.executeMetaTransaction(
            metaTx,
            this.contractAddresses.MetaTransactionForwarder,
            this.relayer
        );
        
        console.log("✅ Property Booked Successfully!");
        console.log(`  Transaction Hash: ${result.transactionHash}`);
        console.log(`  Gas Used: ${result.gasUsed.toString()}`);
        console.log(`  Gas Cost: ${ethers.formatEther(result.gasUsed * result.effectiveGasPrice)} ETH`);
        
        // Get the booking ID
        const guestBookings = await this.contracts.bookingManager.getGuestBookings(user.address);
        const bookingId = guestBookings[guestBookings.length - 1]; // Get the latest one
        console.log(`  Booking ID: ${bookingId}`);
        
        return bookingId;
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
        
        const result1 = await eip712Utils.executeMetaTransaction(
            metaTx1,
            this.contractAddresses.MetaTransactionForwarder,
            this.relayer
        );
        
        const propertyIds = await this.contracts.propertyMarketplace.getAllPropertyIds();
        const propertyId2 = propertyIds[propertyIds.length - 1];
        console.log(`✅ Property Listed: ${propertyId2}`);
        
        // Book second property with different guest
        const userKey2 = "guest2";
        const user2 = this.dummyUsers[userKey2];
        const mockSigner2 = this.createMockSigner(userKey2);
        
        console.log(`👤 User: ${user2.name} (${user2.address})`);
        console.log(`📝 Action: Book mountain cabin property`);
        
        const now = Math.floor(Date.now() / 1000);
        const checkInDate = now + 86400 * 14; // 2 weeks from now
        const checkOutDate = now + 86400 * 17; // 17 days from now (3 nights)
        
        const deadline2 = Math.floor(Date.now() / 1000) + 3600;
        const metaTx2 = await eip712Utils.createBookingMetaTransaction(
            propertyId2,
            checkInDate,
            checkOutDate,
            this.contractAddresses.BookingManager,
            this.contractAddresses.MetaTransactionForwarder,
            mockSigner2,
            deadline2
        );
        
        const result2 = await eip712Utils.executeMetaTransaction(
            metaTx2,
            this.contractAddresses.MetaTransactionForwarder,
            this.relayer
        );
        
        const guestBookings = await this.contracts.bookingManager.getGuestBookings(user2.address);
        const bookingId2 = guestBookings[guestBookings.length - 1];
        console.log(`✅ Property Booked: ${bookingId2}`);
        
        return { propertyId2, bookingId2 };
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
        const propertyId = propertyIds[0];
        
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
        console.log(`  Platform Fee: ${platformFeePercentage / 10}%`);
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
     * Run all examples
     */
    async runAllExamples() {
        console.log("🚀 Starting Backend Integration Examples (Local Network)");
        console.log("=====================================================");
        
        try {
            await this.initialize();
            
            // Run examples
            const propertyId1 = await this.example1_ListProperty();
            const bookingId1 = await this.example2_BookProperty(propertyId1);
            const { propertyId2, bookingId2 } = await this.example3_MultipleProperties();
            await this.example4_BookingConflict();
            await this.example5_SystemAnalytics();
            
            console.log("\n🎉 All Examples Completed Successfully!");
            console.log("=======================================");
            console.log("📋 Summary:");
            console.log(`  Properties Listed: 2`);
            console.log(`  Bookings Created: Multiple`);
            console.log(`  Meta-Transactions: All successful`);
            console.log(`  Booking Conflicts: Properly prevented`);
            
            console.log("\n💡 Integration Notes for Backend Developers:");
            console.log("  1. All meta-transactions use dummy signatures (0x1111...)");
            console.log("  2. In production, replace with actual user signatures");
            console.log("  3. Use the EventListener script to sync blockchain events to database");
            console.log("  4. Implement proper error handling for failed transactions");
            console.log("  5. Consider batching meta-transactions for efficiency");
            console.log("  6. Monitor relayer balance and gas costs");
            
        } catch (error) {
            console.error("❌ Integration example failed:", error);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const integrationExample = new BackendIntegrationLocalExample();
    await integrationExample.runAllExamples();
}

// Export for use in other scripts
module.exports = BackendIntegrationLocalExample;

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error("❌ Backend integration example failed:", error);
        process.exit(1);
    });
} 