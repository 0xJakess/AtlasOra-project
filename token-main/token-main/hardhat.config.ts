import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

const config: HardhatUserConfig = {
	solidity: {
		version: "0.8.24",
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
			chainId: 1337,
		},
		base: {
			url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			chainId: 8453,
			gasPrice: "auto",
		},
		baseSepolia: {
			url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			chainId: 84532,
			gasPrice: "auto",
		},
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "",
		customChains: [
			{
				network: "base",
				chainId: 8453,
				urls: {
					apiURL: "https://api.basescan.org/api",
					browserURL: "https://basescan.org",
				},
			},
			{
				network: "baseSepolia",
				chainId: 84532,
				urls: {
					apiURL: "https://api-sepolia.basescan.org/api",
					browserURL: "https://sepolia.basescan.org",
				},
			},
		],
	},
	gasReporter: {
		enabled: process.env.REPORT_GAS === "true",
		currency: "USD",
		coinmarketcap: process.env.COINMARKETCAP_API_KEY,
	},
	paths: {
		sources: "./contracts",
		tests: "./test",
		cache: "./cache",
		artifacts: "./artifacts",
	},
	typechain: {
		outDir: "typechain-types",
		target: "ethers-v6",
	},
};

export default config;
