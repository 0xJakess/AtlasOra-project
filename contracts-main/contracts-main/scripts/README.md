# Scripts Directory

This directory contains the essential scripts for the Property Rental System, organized by functionality.

## 📁 Directory Structure

```
scripts/
├── deployment/          # Contract deployment scripts
├── examples/           # Backend integration examples
├── utils/              # Core utility functions
├── events/             # Event listening and monitoring
├── backend-integration-example.js  # Main integration example
├── get-deployed-addresses.js       # Deployment info utility
└── README.md           # This file
```

## 🚀 Deployment Scripts (`deployment/`)

### Core Deployment
- **`deploy-all-viction.js`** - Complete deployment to Viction Testnet with verification
- **`deploy.js`** - Standard deployment script for any network

### Usage
```bash
# Deploy to Viction Testnet
npx hardhat run deployment/deploy-all-viction.js --network victionTestnet

# Deploy to any network
npx hardhat run deployment/deploy.js --network <network>
```

## 📚 Examples (`examples/`)

### Backend Integration
- **`backend-integration-viction.js`** - Complete backend integration example for Viction Testnet
- **`backend-integration-local.js`** - Backend integration example for local development

### Usage
```bash
# Run backend integration example on Viction Testnet
npx hardhat run examples/backend-integration-viction.js --network victionTestnet

# Run backend integration example locally
npx hardhat run examples/backend-integration-local.js --network hardhat
```

## 🔧 Utilities (`utils/`)

### Core Utilities
- **`eip712-utils.js`** - EIP-712 meta-transaction utilities (CRITICAL)
- **`test-viction-rpc.js`** - Test Viction Testnet RPC connectivity

### Usage
```bash
# Test Viction RPC connectivity
npx hardhat run utils/test-viction-rpc.js --network victionTestnet
```

## 📡 Events (`events/`)

### Event Monitoring
- **`event-listener.js`** - Production-ready event listener for database synchronization

### Usage
```bash
# Start event listener
npx hardhat run events/event-listener.js --network victionTestnet
```

## 🔑 Environment Variables

Make sure you have the following environment variables set:

```bash
# Required for deployment
PRIVATE_KEY=your_private_key
VICTION_TESTNET_RPC=your_viction_rpc_url

# Optional for verification
ETHERSCAN_API_KEY=your_etherscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
```

## 📋 Quick Start

1. **Deploy Contracts**:
   ```bash
   npx hardhat run deployment/deploy-all-viction.js --network victionTestnet
   ```

2. **Test Backend Integration**:
   ```bash
   npx hardhat run examples/backend-integration-viction.js --network victionTestnet
   ```

3. **Monitor Events**:
   ```bash
   npx hardhat run events/event-listener.js --network victionTestnet
   ```

## 🎯 Key Features

### Meta-Transactions
- Gasless transactions using EIP-712 signatures
- Backend pays for gas on behalf of users
- Secure signature verification

### Property Management
- List properties with tokenization
- Update property details
- Remove properties from listings

### Booking System
- Create bookings with conflict prevention
- Check-in/check-out management
- Dispute resolution system

### Event Monitoring
- Real-time blockchain event listening
- Database synchronization support
- Comprehensive event logging

## 🔒 Security Features

- **Nonce Management**: Prevents replay attacks
- **Signature Verification**: EIP-712 compliant
- **Access Control**: Owner-only functions
- **Input Validation**: Comprehensive parameter checks

## 📊 Contract Addresses

After deployment, contract addresses are saved to:
- `deployment-all-viction-testnet.json` - Viction Testnet deployment
- `deployment-<network>.json` - Other network deployments

## 🚨 Troubleshooting

### Common Issues

1. **RPC Connection Failed**:
   - Check your RPC URL in `.env`
   - Verify network connectivity

2. **Gas Estimation Failed**:
   - Scripts use manual gas settings for Viction Testnet
   - Adjust gas limits if needed

3. **Signature Verification Failed**:
   - Ensure you're using the correct domain separator
   - Check nonce values

4. **Contract Not Found**:
   - Verify deployment was successful
   - Check contract addresses in deployment files

### Debug Commands

```bash
# Test RPC connectivity
npx hardhat run utils/test-viction-rpc.js --network victionTestnet

# Get deployed addresses
npx hardhat run get-deployed-addresses.js --network victionTestnet
```

## 📖 Documentation

- **`BACKEND_INTEGRATION_GUIDE.md`** - Complete backend integration guide
- **`BACKEND_HANDOVER.md`** - Handover document for backend developers
- **`DEPLOYMENT_GUIDE.md`** - Detailed deployment instructions

## 🤝 Contributing

When adding new scripts:
1. Place them in the appropriate directory
2. Update this README with usage instructions
3. Follow the existing naming conventions
4. Include proper error handling and logging 