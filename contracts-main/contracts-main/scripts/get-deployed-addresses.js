// Get Deployed Contract Addresses
const hre = require("hardhat");

async function main() {
	console.log("=== Retrieving Deployed Contract Addresses ===");
	
	const [deployer] = await hre.ethers.getSigners();
	console.log("Deployer address:", deployer.address);
	
	// Get the nonce to find the deployed contract addresses
	const nonce = await hre.ethers.provider.getTransactionCount(deployer.address);
	console.log("Current nonce:", nonce);
	
	// Calculate the address of the PropertyMarketplace contract
	// It should be at nonce - 1 (since it was the last transaction)
	const propertyMarketplaceAddress = hre.ethers.getCreateAddress({
		from: deployer.address,
		nonce: nonce - 1
	});
	
	console.log("\n📋 Deployed Contract Addresses:");
	console.log("PropertyMarketplace:", propertyMarketplaceAddress);
	console.log("\n🔗 View on Vicscan:");
	console.log(`https://testnet.vicscan.xyz/address/${propertyMarketplaceAddress}`);
	
	// Test if the contract exists by trying to call a function
	try {
		const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
		const propertyMarketplace = PropertyMarketplace.attach(propertyMarketplaceAddress);
		
		// Try to call a view function to verify the contract exists
		const feeRecipient = await propertyMarketplace.feeRecipient();
		console.log("\n✅ PropertyMarketplace contract verified!");
		console.log("Fee recipient:", feeRecipient);
		
		// Save deployment info
		const fs = require("fs");
		const deploymentInfo = {
			network: "victionTestnet",
			chainId: 89,
			deployer: deployer.address,
			deploymentTime: new Date().toISOString(),
			contracts: {
				PropertyMarketplace: propertyMarketplaceAddress,
				BookingManager: "NOT_DEPLOYED_YET"
			}
		};
		
		fs.writeFileSync(
			"deployment-viction-testnet.json", 
			JSON.stringify(deploymentInfo, null, 2)
		);
		console.log("\n💾 Deployment info saved to: deployment-viction-testnet.json");
		
		console.log("\n🎯 Next step: Deploy BookingManager");
		console.log("Run: npx hardhat run scripts/deploy-booking-manager.js --network victionTestnet");
		
	} catch (error) {
		console.error("❌ Could not verify PropertyMarketplace contract:", error.message);
		console.log("💡 The contract might still be deploying or the address might be incorrect");
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	}); 