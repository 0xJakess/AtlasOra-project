// Deploy All Contracts to Viction Testnet
const hre = require("hardhat");

async function main() {
	console.log("=== Deploying All Contracts to Viction Testnet ===");
	
	const [deployer] = await hre.ethers.getSigners();
	console.log("Deploying with account:", deployer.address);
	
	// Check balance
	const balance = await hre.ethers.provider.getBalance(deployer.address);
	console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
	
	if (balance < hre.ethers.parseEther("0.01")) {
		console.error("❌ Insufficient balance for deployment");
		process.exit(1);
	}
	
	console.log("✅ Sufficient balance for deployment");
	
	// Step 1: Deploy MetaTransactionForwarder first (needed for constructors)
	console.log("\n📦 Step 1: Deploying MetaTransactionForwarder...");
	let forwarder;
	try {
		const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
		
		const deploymentOptions = {
			gasLimit: 2_000_000, // 2M gas limit
			gasPrice: hre.ethers.parseUnits("0.25", "gwei")
		};
		
		console.log("   Using manual gas settings:", deploymentOptions);
		forwarder = await MetaTransactionForwarder.deploy(deploymentOptions);
		console.log("   Transaction sent, waiting for deployment...");
		await forwarder.waitForDeployment();
		
		const forwarderAddress = await forwarder.getAddress();
		console.log("✅ MetaTransactionForwarder deployed to:", forwarderAddress);
		
	} catch (error) {
		console.error("❌ MetaTransactionForwarder deployment failed:", error.message);
		process.exit(1);
	}
	
	// Step 2: Deploy PropertyMarketplace (needs feeRecipient and forwarder)
	console.log("\n📦 Step 2: Deploying PropertyMarketplace...");
	let propertyMarketplace;
	try {
		const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
		
		// Use manual gas settings
		const deploymentOptions = {
			gasLimit: 3_000_000, // 3M gas limit
			gasPrice: hre.ethers.parseUnits("0.25", "gwei")
		};
		
		console.log("   Using manual gas settings:", deploymentOptions);
		propertyMarketplace = await PropertyMarketplace.deploy(deployer.address, await forwarder.getAddress(), deploymentOptions);
		console.log("   Transaction sent, waiting for deployment...");
		await propertyMarketplace.waitForDeployment();
		
		const propertyMarketplaceAddress = await propertyMarketplace.getAddress();
		console.log("✅ PropertyMarketplace deployed to:", propertyMarketplaceAddress);
		
	} catch (error) {
		console.error("❌ PropertyMarketplace deployment failed:", error.message);
		process.exit(1);
	}
	
	// Step 3: Deploy BookingManager (needs marketplace and forwarder)
	console.log("\n📦 Step 3: Deploying BookingManager...");
	let bookingManager;
	try {
		const BookingManager = await hre.ethers.getContractFactory("BookingManager");
		const propertyMarketplaceAddress = await propertyMarketplace.getAddress();
		
		const deploymentOptions = {
			gasLimit: 4_000_000, // 4M gas limit
			gasPrice: hre.ethers.parseUnits("0.25", "gwei")
		};
		
		console.log("   Using manual gas settings:", deploymentOptions);
		bookingManager = await BookingManager.deploy(propertyMarketplaceAddress, await forwarder.getAddress(), deploymentOptions);
		console.log("   Transaction sent, waiting for deployment...");
		await bookingManager.waitForDeployment();
		
		const bookingManagerAddress = await bookingManager.getAddress();
		console.log("✅ BookingManager deployed to:", bookingManagerAddress);
		
	} catch (error) {
		console.error("❌ BookingManager deployment failed:", error.message);
		process.exit(1);
	}
	
	// Wait for all confirmations
	console.log("\n⏳ Waiting for confirmations...");
	await forwarder.deploymentTransaction().wait(3);
	await propertyMarketplace.deploymentTransaction().wait(3);
	await bookingManager.deploymentTransaction().wait(3);
	console.log("✅ All confirmations received");
	
	// Get all addresses
	const propertyMarketplaceAddress = await propertyMarketplace.getAddress();
	const bookingManagerAddress = await bookingManager.getAddress();
	const forwarderAddress = await forwarder.getAddress();
	
	// Save deployment info
	const fs = require("fs");
	const deploymentInfo = {
		network: "victionTestnet",
		chainId: 89,
		deployer: deployer.address,
		deploymentTime: new Date().toISOString(),
		contracts: {
			PropertyMarketplace: propertyMarketplaceAddress,
			BookingManager: bookingManagerAddress,
			MetaTransactionForwarder: forwarderAddress
		}
	};
	
	fs.writeFileSync(
		"deployment-all-viction-testnet.json", 
		JSON.stringify(deploymentInfo, null, 2)
	);
	console.log("\n💾 Deployment info saved to: deployment-all-viction-testnet.json");
	
	// Display final deployment info
	console.log("\n🎉 All Contracts Deployed Successfully!");
	console.log("=====================================");
	console.log("Network: Viction Testnet");
	console.log("Deployer:", deployer.address);
	console.log("PropertyMarketplace:", propertyMarketplaceAddress);
	console.log("BookingManager:", bookingManagerAddress);
	console.log("MetaTransactionForwarder:", forwarderAddress);
	console.log("=====================================");
	
	console.log("\n🔗 View on Vicscan:");
	console.log(`https://testnet.vicscan.xyz/address/${propertyMarketplaceAddress}`);
	console.log(`https://testnet.vicscan.xyz/address/${bookingManagerAddress}`);
	console.log(`https://testnet.vicscan.xyz/address/${forwarderAddress}`);
	
	// Show environment variables to add to .env
	console.log("\n🔧 Add these to your .env file:");
	console.log(`FORWARDER_ADDRESS=${forwarderAddress}`);
	console.log(`BOOKING_MANAGER_ADDRESS=${bookingManagerAddress}`);
	console.log(`PROPERTY_MARKETPLACE_ADDRESS=${propertyMarketplaceAddress}`);
	
	// Test the contracts
	console.log("\n🧪 Testing deployed contracts...");
	try {
		// Test PropertyMarketplace
		const feeRecipient = await propertyMarketplace.feeRecipient();
		console.log("✅ PropertyMarketplace: Fee recipient =", feeRecipient);
		
		// Test BookingManager
		const marketplaceAddress = await bookingManager.propertyMarketplace();
		console.log("✅ BookingManager: PropertyMarketplace =", marketplaceAddress);
		
		// Test MetaTransactionForwarder
		const domainSeparator = await forwarder.getDomainSeparator();
		console.log("✅ MetaTransactionForwarder: Domain separator =", domainSeparator);
		
		console.log("✅ All contracts tested successfully!");
		
	} catch (error) {
		console.error("❌ Contract testing failed:", error.message);
	}
	
	console.log("\n🚀 Ready to use meta-transactions!");
	console.log("Run: node backend-example.js");
	console.log("Open: frontend-example.html");
}

main()
	.then(() => {
		console.log("\n✅ Complete deployment finished successfully");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n❌ Deployment failed:", error);
		process.exit(1);
	}); 