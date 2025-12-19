# AtlasOra Token

An ERC20 token implementation with scheduled emissions for the Base blockchain network.

## Overview

AtlasOra Token is an ERC20-compliant token built with OpenZeppelin's audited contracts, featuring a time-locked emission schedule that gradually releases tokens to a foundation address over a 4-year period.

### Key Features

- **ERC20 Standard**: Full compatibility with the ERC20 token standard
- **Burnable**: Token holders can burn their tokens
- **Scheduled Emissions**: Automated release schedule with 9 emission cycles
- **Maximum Supply Cap**: Hard cap of 200,000,000 tokens
- **Base Network**: Deployed on Base mainnet and testnet
- **Security**: Built with OpenZeppelin's battle-tested contracts

## Token Economics

### Supply Distribution

- **Total Maximum Supply**: 200,000,000 tokens
- **Initial Supply**: 15% (30,000,000 tokens) - minted at deployment
- **Emission Schedule**: 85% (170,000,000 tokens) - released over 9 cycles

### Emission Schedule

| Cycle       | Percentage | Amount     | Time from Deployment |
| ----------- | ---------- | ---------- | -------------------- |
| 0 (Initial) | 15%        | 30,000,000 | At deployment        |
| 1           | 10%        | 20,000,000 | 6 months             |
| 2           | 10%        | 20,000,000 | 12 months            |
| 3           | 10%        | 20,000,000 | 18 months            |
| 4           | 10%        | 20,000,000 | 24 months            |
| 5           | 10%        | 20,000,000 | 30 months            |
| 6           | 10%        | 20,000,000 | 36 months            |
| 7           | 10%        | 20,000,000 | 42 months            |
| 8           | 10%        | 20,000,000 | 48 months            |
| 9           | 5%         | 10,000,000 | 54 months            |

**Total Timeline**: 4.5 years for complete emission

## Technical Details

### Contract Information

- **Solidity Version**: ^0.8.24
- **License**: MIT
- **Token Standard**: ERC20
- **Decimals**: 18
- **Network**: Base (Mainnet & Sepolia Testnet)

### Dependencies

- OpenZeppelin Contracts v5.0.1
- Hardhat Development Environment
- TypeScript Support

### Smart Contract Architecture

The AtlasOraToken contract inherits from:

- `ERC20`: Standard token functionality
- `ERC20Burnable`: Burn mechanism
- `Ownable`: Access control for minting

Key functions:

- `mint()`: Owner-only function to mint scheduled emissions
- `burn()`: Allows token holders to burn their tokens
- `nextEmissionTimestamp()`: View when next emission is available
- `nextEmissionAmount()`: View amount of next emission
- `isEmissionAvailable()`: Check if emission can be minted
- `getEmissionInfo()`: Get comprehensive emission schedule data

## Installation

### Prerequisites

- Node.js >= 18.x
- npm or yarn

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd token
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Configure your `.env` file with:
   - `PRIVATE_KEY`: Your deployment wallet private key
   - `BASESCAN_API_KEY`: API key from [Basescan](https://basescan.org/myapikey)
   - Optional RPC URLs and API keys

## Usage

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm run test
```

### Check Test Coverage

```bash
npm run coverage
```

### Deploy

Deploy to Base Sepolia (testnet):

```bash
npm run deploy:base-sepolia
```

Deploy to Base Mainnet:

```bash
npm run deploy:base
```

### Verify Contract

Verify on Base Sepolia:

```bash
npm run verify:base-sepolia
```

Verify on Base Mainnet:

```bash
npm run verify:base
```

### Code Quality

Lint code:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

## Development

### Project Structure

```
.
├── contracts/           # Solidity smart contracts
│   └── AtlasOraToken.sol
├── scripts/            # Deployment and utility scripts
│   ├── deploy.ts
│   └── verify.ts
├── test/               # Contract tests
├── config/             # Configuration files
├── hardhat.config.ts   # Hardhat configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies
```

### Testing

The project uses Hardhat's testing framework with Chai matchers. Tests cover:

- Token deployment and initialization
- Emission schedule mechanics
- Access control
- Edge cases and security considerations

### Gas Optimization

The contract is compiled with:

- Optimizer enabled (200 runs)
- Via IR compilation for better optimization
- Gas reporting available with `REPORT_GAS=true`

## Security Considerations

- **Audited Dependencies**: Uses OpenZeppelin's audited contracts
- **Immutable Parameters**: Critical addresses set at deployment
- **Time-Based Restrictions**: Emissions locked by block timestamps
- **Maximum Supply Cap**: Hard limit prevents inflation
- **Owner Controls**: Only owner can mint, following strict schedule
- **Sequential Emissions**: Cannot skip cycles

## Networks

### Base Mainnet

- **Chain ID**: 8453
- **RPC**: https://mainnet.base.org
- **Explorer**: https://basescan.org

### Base Sepolia (Testnet)

- **Chain ID**: 84532
- **RPC**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Resources

- [Base Network Documentation](https://docs.base.org)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [ERC20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)

## Support

For issues and questions:

- Open an issue on GitHub
- Check existing documentation
- Review test files for usage examples

## Disclaimer

This software is provided "as is", without warranty of any kind. Users should conduct their own security audits before deploying to mainnet or handling real value.
