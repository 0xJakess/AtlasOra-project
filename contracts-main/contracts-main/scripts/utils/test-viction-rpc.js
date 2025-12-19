// Test Viction Testnet RPC Connectivity
const hre = require("hardhat");

async function main() {
	console.log("=== Testing Viction Testnet RPC Connectivity ===");
	
	try {
		// Test basic connection
		console.log("🔍 Testing network connection...");
		const network = await hre.ethers.provider.getNetwork();
		console.log("✅ Network connected successfully");
		console.log("   Chain ID:", network.chainId);
		console.log("   Network name:", hre.network.name);
		
		// Test block number
		console.log("\n🔍 Testing block number retrieval...");
		const blockNumber = await hre.ethers.provider.getBlockNumber();
		console.log("✅ Current block number:", blockNumber);
		
		// Test gas price
		console.log("\n🔍 Testing gas price retrieval...");
		const gasPrice = await hre.ethers.provider.getFeeData();
		console.log("✅ Gas price:", hre.ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
		
		// Test account balance (if private key is set)
		const [deployer] = await hre.ethers.getSigners();
		if (deployer.address !== "0x0000000000000000000000000000000000000000") {
			console.log("\n🔍 Testing account balance...");
			const balance = await hre.ethers.provider.getBalance(deployer.address);
			console.log("✅ Account balance:", hre.ethers.formatEther(balance), "VIC");
			console.log("   Account address:", deployer.address);
		} else {
			console.log("\n⚠️  No private key configured, skipping balance check");
		}
		
		console.log("\n🎉 All RPC tests passed! The network is working correctly.");
		console.log("💡 You can now proceed with deployment.");
		
	} catch (error) {
		console.error("\n❌ RPC test failed:", error.message);
		console.log("\n💡 Troubleshooting tips:");
		console.log("   1. Check your internet connection");
		console.log("   2. Try the alternative RPC endpoint:");
		console.log("      npx hardhat run scripts/test-viction-rpc.js --network victionTestnetAlt");
		console.log("   3. Check if Viction Testnet is experiencing issues");
		console.log("   4. Try again in a few minutes");
		
		process.exit(1);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	}); 