require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

// Import tasks
require("./tasks/deploy");

// Read environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

// RPC URLs
const ARBITRUM_MAINNET_RPC = process.env.ARBITRUM_MAINNET_RPC || `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const ARBITRUM_SEPOLIA_RPC = process.env.ARBITRUM_SEPOLIA_RPC || `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const BASE_MAINNET_RPC = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
const VICTION_TESTNET_RPC = process.env.VICTION_TESTNET_RPC || "https://rpc-testnet.viction.xyz";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: {
		version: "0.8.28",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
			viaIR: true,
		},
	},
	networks: {
		hardhat: {
			chainId: 31337,
		},
		// Base Networks (Primary)
		baseSepolia: {
			url: BASE_SEPOLIA_RPC,
			accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
			chainId: 84532,
			timeout: 60000,
			gas: "auto",
			gasPrice: "auto",
		},
		base: {
			url: BASE_MAINNET_RPC,
			accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
			chainId: 8453,
			timeout: 60000,
			gas: "auto",
			gasPrice: "auto",
		},
		// Arbitrum Networks
		arbitrum: {
			url: ARBITRUM_MAINNET_RPC,
			accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
			chainId: 42161,
		},
		arbitrumSepolia: {
			url: ARBITRUM_SEPOLIA_RPC,
			accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
			chainId: 421614,
		},
		// Viction Networks (Legacy)
		victionTestnet: {
			url: VICTION_TESTNET_RPC,
			accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? [PRIVATE_KEY] : [],
			chainId: 89,
			timeout: 60000,
			gas: "auto",
			gasPrice: "auto",
		},
	},
	etherscan: {
		apiKey: {
			mainnet: ETHERSCAN_API_KEY,
			baseSepolia: BASESCAN_API_KEY,
			base: BASESCAN_API_KEY,
			arbitrum: ARBISCAN_API_KEY,
			arbitrumSepolia: ARBISCAN_API_KEY,
		},
		customChains: [
			{
				network: "baseSepolia",
				chainId: 84532,
				urls: {
					apiURL: "https://api-sepolia.basescan.org/api",
					browserURL: "https://sepolia.basescan.org/",
				},
			},
			{
				network: "base",
				chainId: 8453,
				urls: {
					apiURL: "https://api.basescan.org/api",
					browserURL: "https://basescan.org/",
				},
			},
			{
				network: "arbitrumSepolia",
				chainId: 421614,
				urls: {
					apiURL: "https://api-sepolia.arbiscan.io/api",
					browserURL: "https://sepolia.arbiscan.io/",
				},
			},
		],
	},
	paths: {
		sources: "./contracts",
		tests: "./test",
		cache: "./cache",
		artifacts: "./artifacts",
	},
	mocha: {
		timeout: 40000,
	},
};
