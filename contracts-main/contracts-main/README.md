# 🏠 Property Rental System - Blockchain-Powered Airbnb Alternative

A complete, production-ready property rental system built on blockchain technology with **gasless transactions** and **real-time event monitoring**. Users can list and book properties without needing cryptocurrency - your backend handles all gas fees.

## 🎯 What We've Built

A fully functional Airbnb-like platform with:
- ✅ **Gasless Transactions** - Users don't need ETH for gas fees
- ✅ **Property Tokenization** - Each property gets 1000 ERC20 tokens
- ✅ **Complete Booking System** - Full lifecycle with dispute resolution
- ✅ **Real-Time Event Monitoring** - All blockchain activity synced to database
- ✅ **Meta-Transactions** - EIP-712 compliant signature verification
- ✅ **Production Ready** - Tested and working on Viction Testnet

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Blockchain    │
│   (User App)    │    │   (Your API)    │    │  (Viction)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. User signs         │ 2. Backend submits    │ 3. Contract
         │    EIP-712 message    │    transaction        │    executes
         │                       │    (pays gas)         │
         └───────────────────────┼───────────────────────┘
                                 │
                                 │ 4. Backend listens
                                 │    for events
                                 └───────────────────────┘
```

## 📊 Deployed Contracts (Viction Testnet)

```json
{
  "network": "victionTestnet",
  "chainId": 89,
  "contracts": {
    "PropertyMarketplace": "0xC26151CCB9f88273149FDD2E22d562D1FA3aBF49",
    "BookingManager": "0xBB70120EC9FBf6eef0BC15126b6D5A3B31f7B38B",
    "MetaTransactionForwarder": "0xD98147BC05362630e2cDAcC57ABB962951Eec293"
  }
}
```

## 🚀 Quick Start

### 1. **Clone and Setup**
```bash
git clone <repository-url>
cd atlas
npm install
```

### 2. **Environment Setup**
```bash
# Copy .env.example and configure
cp .env.example .env

# Add your configuration
PRIVATE_KEY=your_private_key
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
```

### 3. **Deploy Contracts**
```bash
# Deploy to Viction Testnet
npx hardhat run scripts/deployment/deploy-all-viction.js --network victionTestnet
```

### 4. **Set up Backend**
```bash
# Install backend dependencies
cd backend
npm install

# Configure environment
cp env.example .env
# Edit .env with your relayer private key

# Start the backend server
npm start
```

### 5. **Test the System**
```bash
# Test backend endpoints
node test-endpoints.js

# Run complete backend integration example
npx hardhat run scripts/examples/backend-integration-viction.js --network victionTestnet

# Start event listener for database sync
npx hardhat run scripts/events/event-listener.js --network victionTestnet
```

## 📁 Project Structure

```
atlas/
├── contracts/                    # Smart contracts
│   ├── PropertyMarketplace.sol  # Property listing and management
│   ├── BookingManager.sol       # Booking lifecycle and disputes
│   ├── MetaTransactionForwarder.sol # Gasless transaction handling
│   ├── PropertyToken.sol        # ERC20 tokens for properties
│   └── EIP712Domain.sol         # EIP-712 domain separator
├── backend/                     # Express.js backend server
│   ├── server.js               # Main server file
│   ├── package.json            # Backend dependencies
│   ├── test-endpoints.js       # API endpoint tests
│   ├── README.md               # Backend documentation
│   └── env.example             # Environment template
├── scripts/
│   ├── deployment/              # Contract deployment scripts
│   ├── examples/               # Backend integration examples
│   ├── utils/                  # Core utility functions
│   ├── events/                 # Event listening and monitoring
│   └── README.md               # Scripts documentation
├── test/                       # Contract tests
├── BACKEND_INTEGRATION_GUIDE.md # Complete backend integration guide
├── BACKEND_HANDOVER.md         # Handover document for backend developers
├── DEPLOYMENT_GUIDE.md         # Detailed deployment instructions
└── README.md                   # This file
```

## 🔧 Core Features

### **🏠 Property Management**
- **List Properties** - Create property listings with IPFS metadata
- **Property Tokenization** - Each property gets 1000 ERC20 tokens
- **Update Properties** - Modify prices and availability
- **Remove Properties** - Deactivate property listings

### **📅 Booking System**
- **Create Bookings** - Book properties with conflict prevention
- **Check-in/Check-out** - Complete booking lifecycle management
- **Dispute Resolution** - Handle missed check-ins and disputes
- **Automatic Refunds** - Process cancellations and refunds

### **🔀 Meta-Transactions**
- **Gasless User Experience** - Users sign messages, backend pays gas
- **EIP-712 Signatures** - Secure, standardized signature verification
- **Nonce Management** - Prevents replay attacks
- **Deadline Validation** - Ensures transaction freshness

### **📡 Event Monitoring**
- **Real-Time Events** - Monitor all blockchain activity
- **Database Sync** - Automatic data synchronization
- **Complete Data Capture** - IPFS URLs, prices, booking details
- **Error Handling** - Graceful fallback and recovery

## 📋 Complete Data Captured

### **Property Events**
```json
{
  "propertyId": "PROP1",
  "tokenAddress": "0xa16E02E87b7454126E5E10d957A927A7F5B5d2be",
  "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "pricePerNight": "150000000000000000", // 0.15 ETH in wei
  "isActive": true,
  "propertyURI": "ipfs://QmTestProperty1", // IPFS URL with property details
  "tokenName": "Test Property Token",
  "tokenSymbol": "TPT"
}
```

### **Booking Events**
```json
{
  "bookingId": "1",
  "propertyId": "PROP1",
  "guest": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "checkInDate": "1754494894",
  "checkOutDate": "1754754094",
  "totalAmount": "450000000000000000", // 0.45 ETH in wei
  "platformFee": "13500000000000000", // 3% platform fee
  "hostAmount": "436500000000000000", // Amount to host
  "status": "Active",
  "propertyOwner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "propertyPricePerNight": "150000000000000000",
  "propertyURI": "ipfs://QmTestProperty1",
  "numberOfNights": 3
}
```

## 🔑 Backend Integration

### **Essential Files for Your Backend**
```bash
# Copy these files to your backend project
cp scripts/utils/eip712-utils.js /your-backend/src/utils/
cp scripts/events/event-listener.js /your-backend/src/events/
cp deployment-all-viction-testnet.json /your-backend/config/

# Extract contract ABIs
cat artifacts/contracts/PropertyMarketplace.sol/PropertyMarketplace.json | jq '.abi' > /your-backend/src/contracts/PropertyMarketplace.json
cat artifacts/contracts/BookingManager.sol/BookingManager.json | jq '.abi' > /your-backend/src/contracts/BookingManager.json
cat artifacts/contracts/MetaTransactionForwarder.sol/MetaTransactionForwarder.json | jq '.abi' > /your-backend/src/contracts/MetaTransactionForwarder.json
```

### **Required Dependencies**
```bash
npm install ethers@6.14.1 @openzeppelin/contracts
```

### **Environment Variables**
```bash
# Network Configuration
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
CHAIN_ID=89

# Contract Addresses
FORWARDER_ADDRESS=0x666D80F535aa77f93e872D225CDf8312A9Cb6780
BOOKING_MANAGER_ADDRESS=0xb646B911725639afceF013023254cD9a32Fca7bB
PROPERTY_MARKETPLACE_ADDRESS=0xbd8833f9A072E6e1d75DCA9A3756e6b6Ba919464

# Relayer Configuration
RELAYER_PRIVATE_KEY=your_private_key_here
DATABASE_URL=your_database_connection_string
```

## 📖 Documentation

### **For Backend Developers**
- **[BACKEND_INTEGRATION_GUIDE.md](BACKEND_INTEGRATION_GUIDE.md)** - Complete integration guide for non-blockchain developers
- **[BACKEND_HANDOVER.md](BACKEND_HANDOVER.md)** - Handover document with all essential information
- **[scripts/README.md](scripts/README.md)** - Detailed scripts documentation

### **For Deployment**
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions

## 🧪 Testing

### **Test Commands**
```bash
# Test meta-transactions on Viction Testnet
npx hardhat run scripts/examples/backend-integration-viction.js --network victionTestnet

# Test RPC connectivity
npx hardhat run scripts/utils/test-viction-rpc.js --network victionTestnet

# Run contract tests
npx hardhat test

# Start event listener
npx hardhat run scripts/events/event-listener.js --network victionTestnet
```

### **Test Scenarios**
1. **Property Listing** - Users list properties using meta-transactions
2. **Property Booking** - Users book properties using meta-transactions
3. **Check-in Process** - Guest checks in within the 24-hour window
4. **Dispute Resolution** - Handle missed check-ins and disputes
5. **Event Monitoring** - Verify all events are captured correctly

## 🗄️ Database Schema

### **Properties Table**
```sql
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
```

### **Bookings Table**
```sql
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
    property_owner VARCHAR(42) NOT NULL,
    property_price_per_night DECIMAL(18,8) NOT NULL,
    property_uri TEXT NOT NULL,
    number_of_nights INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id)
);
```

## 🔌 API Endpoints

### **Property Management**
```javascript
POST /api/properties/list     // List a property (gasless)
GET  /api/properties          // Get all properties
POST /api/properties/update   // Update property details
POST /api/properties/remove   // Remove property from listings
```

### **Booking Management**
```javascript
POST /api/bookings/create     // Book a property (gasless)
GET  /api/bookings            // Get all bookings
GET  /api/bookings/user/:address // Get user's bookings
POST /api/bookings/check-in   // Guest check-in
POST /api/bookings/cancel     // Cancel booking
```

## 🚨 Error Handling

### **Common Issues and Solutions**
1. **Invalid Signature** - Check nonce values and domain separator
2. **Transaction Expired** - Generate new signature with updated deadline
3. **Insufficient Gas** - Increase gas limit in deployment settings
4. **Booking Conflict** - Check property availability before booking

## 📊 Monitoring and Analytics

### **Key Metrics**
- Transaction success rate
- Gas costs (paid by backend)
- Event processing speed
- Database sync status
- User activity patterns

### **Logging**
```javascript
console.log(`💰 Gas cost: ${ethers.formatEther(gasUsed * gasPrice)} ETH`);
console.log(`📊 Transaction success rate: ${successRate}%`);
console.log(`⏱️  Average processing time: ${avgTime}ms`);
```

## 🚀 Production Deployment

### **Environment Setup**
```bash
NODE_ENV=production
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
RELAYER_PRIVATE_KEY=your_production_private_key
DATABASE_URL=your_production_database_url
```

### **Security Considerations**
- Store private keys securely (use environment variables)
- Implement rate limiting for API endpoints
- Add authentication and authorization
- Monitor for suspicious activity
- Regular security audits

### **Scaling Strategies**
- Use connection pooling for database
- Implement caching for frequently accessed data
- Consider using message queues for event processing
- Monitor resource usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
