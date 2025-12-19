# 🚀 Backend Integration Guide for Non-Blockchain Developers

## 📋 Overview

This guide provides **everything** you need to integrate the Property Rental System's blockchain functionality into your existing backend. You don't need to understand blockchain deeply - we've abstracted the complexity away.

**What you'll get:**
- ✅ **Gasless transactions** - Users don't need cryptocurrency
- ✅ **Real-time event monitoring** - All blockchain activity synced to your database
- ✅ **Complete property and booking management** - Full Airbnb-like functionality
- ✅ **Production-ready code** - Tested and working on Viction Testnet

## 🎯 What We've Built

A complete property rental system with:
- **Property Tokenization** - Each property gets 1000 ERC20 tokens
- **Gasless Transactions** - Users sign messages, your backend pays gas fees
- **Booking Management** - Complete booking lifecycle with dispute resolution
- **Event-Driven Architecture** - Real-time blockchain event synchronization
- **Meta-Transactions** - EIP-712 compliant signature verification

## 📊 Deployed Contracts (Viction Testnet)

```json
{
  "network": "victionTestnet",
  "chainId": 89,
  "contracts": {
    "PropertyMarketplace": "0xbd8833f9A072E6e1d75DCA9A3756e6b6Ba919464",
    "BookingManager": "0xb646B911725639afceF013023254cD9a32Fca7bB",
    "MetaTransactionForwarder": "0x666D80F535aa77f93e872D225CDf8312A9Cb6780"
  }
}
```

## 📁 Required Files from This Project

### **Essential Files (Copy These to Your Backend)**

#### 1. **Meta-Transaction Utilities** ⭐ CRITICAL
```bash
# Copy this file to your backend
cp scripts/utils/eip712-utils.js /your-backend/src/utils/
```
- Handles EIP-712 signature creation and meta-transaction execution
- Contains all logic for gasless transactions
- **This is the core of the system**

#### 2. **Event Listener** ⭐ PRODUCTION READY
```bash
# Copy this file to your backend
cp scripts/events/event-listener.js /your-backend/src/events/
```
- Real-time blockchain event monitoring
- Syncs all data to your database
- Captures IPFS URLs, prices, booking details, etc.

#### 3. **Contract ABIs** ⭐ REQUIRED
```bash
# Extract ABIs from artifacts
cat artifacts/contracts/PropertyMarketplace.sol/PropertyMarketplace.json | jq '.abi' > /your-backend/src/contracts/PropertyMarketplace.json
cat artifacts/contracts/BookingManager.sol/BookingManager.json | jq '.abi' > /your-backend/src/contracts/BookingManager.json
cat artifacts/contracts/MetaTransactionForwarder.sol/MetaTransactionForwarder.json | jq '.abi' > /your-backend/src/contracts/MetaTransactionForwarder.json
```
- Contract interfaces for your backend
- Extract only the `abi` field from each JSON file

#### 4. **Deployment Info** ⭐ REQUIRED
```bash
# Copy this file to your backend
cp deployment-all-viction-testnet.json /your-backend/config/
```
- Contains all contract addresses and network information

### **Reference Files (Optional but Helpful)**

#### 5. **Integration Examples**
```bash
# Reference these for understanding the flow
cp scripts/examples/backend-integration-viction.js /your-backend/docs/
cp scripts/examples/backend-integration-local.js /your-backend/docs/
```
- Complete working examples
- Shows how to use the utilities
- Good for understanding the flow

## 🛠️ Backend Setup

### **1. Install Dependencies**

```bash
# Add to your package.json
npm install ethers@6.14.1 @openzeppelin/contracts
```

### **2. Environment Variables**

Add these to your `.env` file:

```bash
# Network Configuration
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
CHAIN_ID=89

# Contract Addresses (from deployment-all-viction-testnet.json)
FORWARDER_ADDRESS=0x666D80F535aa77f93e872D225CDf8312A9Cb6780
BOOKING_MANAGER_ADDRESS=0xb646B911725639afceF013023254cD9a32Fca7bB
PROPERTY_MARKETPLACE_ADDRESS=0xbd8833f9A072E6e1d75DCA9A3756e6b6Ba919464

# Relayer Configuration (your backend account that pays for gas)
RELAYER_PRIVATE_KEY=your_private_key_here
RELAYER_ADDRESS=your_relayer_address_here

# Database Configuration (your existing database)
DATABASE_URL=your_database_connection_string
```

### **3. Project Structure**

```
your-backend/
├── src/
│   ├── utils/
│   │   └── eip712-utils.js          # Meta-transaction utilities
│   ├── events/
│   │   └── event-listener.js        # Blockchain event monitoring
│   ├── contracts/
│   │   ├── PropertyMarketplace.json # Contract ABI
│   │   ├── BookingManager.json      # Contract ABI
│   │   └── MetaTransactionForwarder.json # Contract ABI
│   ├── services/
│   │   ├── blockchain.service.js    # Your blockchain service
│   │   └── database.service.js      # Your database service
│   └── routes/
│       ├── properties.routes.js     # Property API endpoints
│       └── bookings.routes.js       # Booking API endpoints
├── config/
│   └── deployment-all-viction-testnet.json # Contract addresses
└── package.json
```

## 🔧 Integration Steps

### **Step 1: Initialize Blockchain Service**

Create `src/services/blockchain.service.js`:

```javascript
const { ethers } = require('ethers');
const eip712Utils = require('../utils/eip712-utils');

class BlockchainService {
    constructor() {
        // Initialize provider
        this.provider = new ethers.JsonRpcProvider(process.env.VICTION_TESTNET_RPC);
        
        // Initialize relayer (your backend account)
        this.relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, this.provider);
        
        // Initialize contracts
        this.initializeContracts();
    }
    
    async initializeContracts() {
        // Load contract ABIs
        const PropertyMarketplaceABI = require('../contracts/PropertyMarketplace.json');
        const BookingManagerABI = require('../contracts/BookingManager.json');
        const MetaTransactionForwarderABI = require('../contracts/MetaTransactionForwarder.json');
        
        // Initialize contract instances
        this.propertyMarketplace = new ethers.Contract(
            process.env.PROPERTY_MARKETPLACE_ADDRESS,
            PropertyMarketplaceABI,
            this.relayer
        );
        
        this.bookingManager = new ethers.Contract(
            process.env.BOOKING_MANAGER_ADDRESS,
            BookingManagerABI,
            this.relayer
        );
        
        this.forwarder = new ethers.Contract(
            process.env.FORWARDER_ADDRESS,
            MetaTransactionForwarderABI,
            this.relayer
        );
    }
    
    // Property listing with meta-transaction
    async listProperty(userAddress, userSignature, propertyData) {
        try {
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
            
            // Create meta-transaction
            const metaTx = await eip712Utils.createListPropertyMetaTransaction(
                propertyData.uri,
                ethers.parseEther(propertyData.pricePerNight.toString()),
                propertyData.tokenName,
                propertyData.tokenSymbol,
                process.env.PROPERTY_MARKETPLACE_ADDRESS,
                process.env.FORWARDER_ADDRESS,
                { getAddress: () => userAddress, signMessage: () => userSignature },
                deadline
            );
            
            // Execute meta-transaction
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
                process.env.FORWARDER_ADDRESS,
                this.relayer
            );
            
            return {
                success: true,
                transactionHash: result.transactionHash,
                propertyId: await this.getLatestPropertyId(userAddress)
            };
            
        } catch (error) {
            console.error('Property listing failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Property booking with meta-transaction
    async bookProperty(userAddress, userSignature, bookingData) {
        try {
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
            
            // Create meta-transaction
            const metaTx = await eip712Utils.createBookingMetaTransaction(
                bookingData.propertyId,
                bookingData.checkInDate,
                bookingData.checkOutDate,
                process.env.BOOKING_MANAGER_ADDRESS,
                process.env.FORWARDER_ADDRESS,
                { getAddress: () => userAddress, signMessage: () => userSignature },
                deadline
            );
            
            // Execute meta-transaction
            const result = await eip712Utils.executeMetaTransaction(
                metaTx,
                process.env.FORWARDER_ADDRESS,
                this.relayer
            );
            
            return {
                success: true,
                transactionHash: result.transactionHash,
                bookingId: await this.getLatestBookingId(userAddress)
            };
            
        } catch (error) {
            console.error('Property booking failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Helper methods
    async getLatestPropertyId(owner) {
        const propertyIds = await this.propertyMarketplace.getAllPropertyIds();
        return propertyIds[propertyIds.length - 1];
    }
    
    async getLatestBookingId(guest) {
        const bookingIds = await this.bookingManager.getGuestBookings(guest);
        return bookingIds[bookingIds.length - 1];
    }
}

module.exports = BlockchainService;
```

### **Step 2: Initialize Event Listener**

Create `src/services/event-listener.service.js`:

```javascript
const EventListener = require('../events/event-listener');
const DatabaseService = require('./database.service');

class EventListenerService {
    constructor() {
        this.eventListener = null;
        this.databaseService = new DatabaseService();
    }
    
    async start() {
        try {
            // Load deployment info
            const deploymentInfo = require('../../config/deployment-all-viction-testnet.json');
            
            // Initialize event listener
            this.eventListener = new EventListener();
            await this.eventListener.initialize(deploymentInfo.contracts);
            
            // Override syncToDatabase method to use your database
            this.eventListener.syncToDatabase = this.handleDatabaseSync.bind(this);
            
            // Start listening
            await this.eventListener.start();
            
            console.log('✅ Event listener started successfully');
            
        } catch (error) {
            console.error('❌ Event listener failed to start:', error);
            throw error;
        }
    }
    
    async handleDatabaseSync(eventType, data) {
        try {
            switch (eventType) {
                case 'PropertyListed':
                    await this.databaseService.createProperty(data);
                    break;
                    
                case 'BookingCreated':
                    await this.databaseService.createBooking(data);
                    break;
                    
                case 'PropertyUpdated':
                    await this.databaseService.updateProperty(data);
                    break;
                    
                case 'CheckedIn':
                    await this.databaseService.updateBookingStatus(data.bookingId, 'CheckedIn');
                    break;
                    
                case 'BookingCompleted':
                    await this.databaseService.updateBookingStatus(data.bookingId, 'Completed');
                    break;
                    
                default:
                    // Log other events
                    await this.databaseService.logEvent(eventType, data);
            }
            
            console.log(`✅ Synced ${eventType} to database`);
            
        } catch (error) {
            console.error(`❌ Database sync failed for ${eventType}:`, error);
        }
    }
    
    stop() {
        if (this.eventListener) {
            this.eventListener.stop();
        }
    }
}

module.exports = EventListenerService;
```

### **Step 3: Create API Endpoints**

Create `src/routes/properties.routes.js`:

```javascript
const express = require('express');
const router = express.Router();
const BlockchainService = require('../services/blockchain.service');

const blockchainService = new BlockchainService();

// List a property (gasless transaction)
router.post('/list', async (req, res) => {
    try {
        const { userAddress, signature, propertyData } = req.body;
        
        // Validate input
        if (!userAddress || !signature || !propertyData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Execute blockchain transaction
        const result = await blockchainService.listProperty(userAddress, signature, propertyData);
        
        if (result.success) {
            res.json({
                success: true,
                propertyId: result.propertyId,
                transactionHash: result.transactionHash
            });
        } else {
            res.status(400).json({ error: result.error });
        }
        
    } catch (error) {
        console.error('Property listing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all properties
router.get('/', async (req, res) => {
    try {
        // Get properties from your database (synced by event listener)
        const properties = await req.app.locals.databaseService.getProperties();
        res.json(properties);
        
    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
```

Create `src/routes/bookings.routes.js`:

```javascript
const express = require('express');
const router = express.Router();
const BlockchainService = require('../services/blockchain.service');

const blockchainService = new BlockchainService();

// Book a property (gasless transaction)
router.post('/create', async (req, res) => {
    try {
        const { userAddress, signature, bookingData } = req.body;
        
        // Validate input
        if (!userAddress || !signature || !bookingData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Execute blockchain transaction
        const result = await blockchainService.bookProperty(userAddress, signature, bookingData);
        
        if (result.success) {
            res.json({
                success: true,
                bookingId: result.bookingId,
                transactionHash: result.transactionHash
            });
        } else {
            res.status(400).json({ error: result.error });
        }
        
    } catch (error) {
        console.error('Property booking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's bookings
router.get('/user/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const bookings = await req.app.locals.databaseService.getUserBookings(address);
        res.json(bookings);
        
    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
```

### **Step 4: Database Schema**

Create the necessary database tables:

```sql
-- Properties table
CREATE TABLE properties (
    id VARCHAR(50) PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    price_per_night DECIMAL(18,8) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    property_uri TEXT NOT NULL, -- IPFS URL with property details
    token_name VARCHAR(100) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE bookings (
    id BIGINT PRIMARY KEY,
    property_id VARCHAR(50) NOT NULL,
    guest_address VARCHAR(42) NOT NULL,
    check_in_date TIMESTAMP NOT NULL,
    check_out_date TIMESTAMP NOT NULL,
    total_amount DECIMAL(18,8) NOT NULL,
    platform_fee DECIMAL(18,8) NOT NULL,
    host_amount DECIMAL(18,8) NOT NULL,
    status VARCHAR(20) NOT NULL,
    check_in_window_start TIMESTAMP,
    check_in_deadline TIMESTAMP,
    dispute_deadline TIMESTAMP,
    is_check_in_complete BOOLEAN DEFAULT false,
    is_resolved_by_host BOOLEAN DEFAULT false,
    is_resolved_by_guest BOOLEAN DEFAULT false,
    dispute_reason TEXT,
    property_owner VARCHAR(42) NOT NULL,
    property_price_per_night DECIMAL(18,8) NOT NULL,
    property_uri TEXT NOT NULL,
    property_token_address VARCHAR(42) NOT NULL,
    number_of_nights INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- Meta transactions table (for tracking)
CREATE TABLE meta_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    function_name VARCHAR(100) NOT NULL,
    function_data TEXT,
    nonce BIGINT NOT NULL,
    signature TEXT NOT NULL,
    transaction_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blockchain events table (for logging)
CREATE TABLE blockchain_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Step 5: Main Application Setup**

Update your main `app.js` or `server.js`:

```javascript
const express = require('express');
const EventListenerService = require('./src/services/event-listener.service');
const DatabaseService = require('./src/services/database.service');

const app = express();

// Middleware
app.use(express.json());

// Initialize services
const databaseService = new DatabaseService();
const eventListenerService = new EventListenerService();

// Make services available to routes
app.locals.databaseService = databaseService;

// Routes
app.use('/api/properties', require('./src/routes/properties.routes'));
app.use('/api/bookings', require('./src/routes/bookings.routes'));

// Start event listener
async function startEventListener() {
    try {
        await eventListenerService.start();
        console.log('✅ Event listener started');
    } catch (error) {
        console.error('❌ Failed to start event listener:', error);
        process.exit(1);
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await startEventListener();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down...');
    eventListenerService.stop();
    process.exit(0);
});
```

## 🔑 Frontend Integration

### **1. User Signs Message (Frontend)**

```javascript
// Frontend code (React/JavaScript)
import { ethers } from 'ethers';

async function listProperty(propertyData) {
    try {
        // Connect to user's wallet
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const userAddress = await signer.getAddress();
        
        // Create the message to sign
        const domain = {
            name: "PropertyRental",
            version: "1",
            chainId: 89, // Viction Testnet
            verifyingContract: "0x666D80F535aa77f93e872D225CDf8312A9Cb6780" // Forwarder address
        };
        
        const types = {
            MetaTransaction: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "data", type: "bytes" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };
        
        const message = {
            from: userAddress,
            to: "0xbd8833f9A072E6e1d75DCA9A3756e6b6Ba919464", // PropertyMarketplace address
            value: 0,
            data: "0x...", // Encoded function call data
            nonce: 0, // Get from backend
            deadline: Math.floor(Date.now() / 1000) + 3600
        };
        
        // User signs the message
        const signature = await signer.signTypedData(domain, types, message);
        
        // Send to backend
        const response = await fetch('/api/properties/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userAddress,
                signature,
                propertyData
            })
        });
        
        const result = await response.json();
        console.log('Property listed:', result);
        
    } catch (error) {
        console.error('Error listing property:', error);
    }
}
```

## 🧪 Testing

### **1. Test the Integration**

```bash
# Test property listing
curl -X POST http://localhost:3000/api/properties/list \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x1234567890123456789012345678901234567890",
    "signature": "0x...",
    "propertyData": {
      "uri": "ipfs://QmTestProperty1",
      "pricePerNight": "0.15",
      "tokenName": "Test Property Token",
      "tokenSymbol": "TPT"
    }
  }'

# Test booking creation
curl -X POST http://localhost:3000/api/bookings/create \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x1234567890123456789012345678901234567890",
    "signature": "0x...",
    "bookingData": {
      "propertyId": "PROP1",
      "checkInDate": "1754494894",
      "checkOutDate": "1754754094"
    }
  }'
```

### **2. Monitor Events**

The event listener will automatically:
- Monitor all blockchain events
- Sync data to your database
- Log all activities

## 🚨 Error Handling

### **Common Issues and Solutions**

1. **Invalid Signature**
   ```javascript
   // Check if user's nonce is correct
   const nonce = await forwarder.getNonce(userAddress);
   ```

2. **Transaction Expired**
   ```javascript
   // Generate new signature with updated deadline
   const newDeadline = Math.floor(Date.now() / 1000) + 3600;
   ```

3. **Insufficient Gas**
   ```javascript
   // Increase gas limit in deployment
   const deploymentOptions = {
       gasLimit: 3000000,
       gasPrice: ethers.parseUnits("0.25", "gwei")
   };
   ```

4. **Booking Conflict**
   ```javascript
   // Check for conflicts before booking
   const hasConflict = await bookingManager.hasBookingConflict(
       propertyId, checkInDate, checkOutDate
   );
   ```

## 📊 Monitoring and Analytics

### **Key Metrics to Track**

1. **Transaction Success Rate**
2. **Gas Costs** (paid by your backend)
3. **Event Processing Speed**
4. **Database Sync Status**
5. **User Activity**

### **Logging**

```javascript
// Add comprehensive logging
console.log(`💰 Gas cost: ${ethers.formatEther(gasUsed * gasPrice)} ETH`);
console.log(`📊 Transaction success rate: ${successRate}%`);
console.log(`⏱️  Average processing time: ${avgTime}ms`);
```

## 🚀 Production Deployment

### **1. Environment Setup**

```bash
# Production environment variables
NODE_ENV=production
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
RELAYER_PRIVATE_KEY=your_production_private_key
DATABASE_URL=your_production_database_url
```

### **2. Security Considerations**

- Store private keys securely (use environment variables)
- Implement rate limiting for API endpoints
- Add authentication and authorization
- Monitor for suspicious activity
- Regular security audits

### **3. Scaling**

- Use connection pooling for database
- Implement caching for frequently accessed data
- Consider using message queues for event processing
- Monitor resource usage

## 📞 Support

If you encounter issues:

1. **Check the logs** - All errors are logged with details
2. **Verify contract addresses** - Ensure they match deployment
3. **Test RPC connectivity** - Use the test script
4. **Check gas balance** - Ensure relayer has sufficient funds

## 🎉 You're Ready!

Your backend is now fully integrated with the blockchain property rental system. Users can:

- ✅ List properties without paying gas fees
- ✅ Book properties without paying gas fees
- ✅ All data automatically synced to your database
- ✅ Real-time event monitoring
- ✅ Complete booking lifecycle management

The system handles all the blockchain complexity while providing a simple API for your frontend! 🚀 