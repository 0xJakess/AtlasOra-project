# Viction Testnet Deployment Guide

## Prerequisites

1. **Get Testnet VIC**: Visit [Viction Faucet](https://faucet.viction.xyz/) to get testnet VIC tokens
2. **Set up Environment Variables**: Create a `.env` file with your private key

## Environment Variables

Create a `.env` file in your project root with:

```bash
# Your private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Viction Testnet RPC (optional - will use default if not provided)
VICTION_TESTNET_RPC=https://rpc-testnet.viction.xyz
```

## Deployment Steps

### 1. Compile Contracts
```bash
npx hardhat compile
```

### 2. Test RPC Connectivity (Recommended)
```bash
npx hardhat run scripts/test-viction-rpc.js --network victionTestnet
```

### 3. Deploy to Viction Testnet
```bash
npx hardhat run scripts/deploy-viction.js --network victionTestnet
```

### 4. Alternative RPC Endpoint (if primary fails)
```bash
npx hardhat run scripts/deploy-viction.js --network victionTestnetAlt
```

### 5. Alternative: Use the General Deploy Script
```bash
npx hardhat run scripts/deploy.js --network victionTestnet
```

## Network Information

- **Network Name**: Viction Testnet
- **Chain ID**: 89
- **RPC URL**: https://rpc-testnet.viction.xyz
- **Block Explorer**: https://testnet.vicscan.xyz
- **Currency**: VIC (testnet tokens)

## What the Script Does

1. ✅ Checks your account balance
2. ✅ Deploys PropertyMarketplace contract
3. ✅ Deploys BookingManager contract
4. ✅ Waits for confirmations
5. ✅ Attempts contract verification
6. ✅ Saves deployment info to `deployment-viction-testnet.json`
7. ✅ Displays contract addresses and explorer links

## Expected Output

```
=== Viction Testnet Deployment ===
Deploying contracts with the account: 0x...
Account balance: 1000000000000000000
Network: victionTestnet
Chain ID: 89
✅ Sufficient balance for deployment

📦 Deploying PropertyMarketplace...
✅ PropertyMarketplace deployed to: 0x...

📦 Deploying BookingManager...
✅ BookingManager deployed to: 0x...

🎉 Deployment complete!
=====================================
PropertyMarketplace: 0x...
BookingManager: 0x...
=====================================

⏳ Waiting for confirmations...
✅ Confirmations received

🔍 Verifying contracts on Vicscan...
✅ PropertyMarketplace verified successfully
✅ BookingManager verified successfully

📋 Deployment Summary:
Network: Viction Testnet
Deployer: 0x...
PropertyMarketplace: 0x...
BookingManager: 0x...

🔗 View on Vicscan:
https://testnet.vicscan.xyz/address/0x...
https://testnet.vicscan.xyz/address/0x...

💾 Deployment info saved to: deployment-viction-testnet.json
✅ Deployment script completed successfully
```

## Troubleshooting

### Insufficient Balance
If you get "Insufficient balance for deployment":
1. Visit [Viction Faucet](https://faucet.viction.xyz/)
2. Request testnet VIC tokens
3. Wait for the transaction to confirm
4. Try deployment again

### Network Connection Issues
If you can't connect to Viction Testnet:
1. **Test RPC connectivity first**:
   ```bash
   npx hardhat run scripts/test-viction-rpc.js --network victionTestnet
   ```
2. **Try alternative RPC endpoint**:
   ```bash
   npx hardhat run scripts/deploy-viction.js --network victionTestnetAlt
   ```
3. Check your internet connection
4. Verify the RPC URL is correct
5. Try again in a few minutes (RPC endpoints can be temporarily unavailable)

### Contract Verification Fails
This is normal for Viction Testnet as the block explorer might not fully support verification yet. Your contracts will still work correctly.

## Next Steps

After successful deployment:
1. Save the contract addresses
2. Update your frontend configuration
3. Test the contracts using the demo scripts
4. Share the deployment info with your team 