// Deploy All Contracts to Base Sepolia
const hre = require("hardhat");

// EURC Token on Base Sepolia (Circle)
const EURC_TOKEN_ADDRESS = "0x808456652fdb597867f38412077A9182bf77359F";

async function main() {
	console.log("=== Deploying All Contracts to Base Sepolia ===");

	const [deployer] = await hre.ethers.getSigners();
	console.log("Deploying with account:", deployer.address);

	// Treasury receives platform fees (using deployer for now)
	const treasuryAddress = deployer.address;
	console.log("Treasury address:", treasuryAddress);
	console.log("EURC token:", EURC_TOKEN_ADDRESS);

	// Check balance
	const balance = await hre.ethers.provider.getBalance(deployer.address);
	console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

	if (balance < hre.ethers.parseEther("0.01")) {
		console.error("❌ Insufficient balance for deployment");
		console.log("💡 Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
		process.exit(1);
	}

	console.log("✅ Sufficient balance for deployment");

	// Step 1: Deploy MetaTransactionForwarder first (needed for constructors)
	console.log("\n📦 Step 1: Deploying MetaTransactionForwarder...");
	let forwarder;
	try {
		const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");

		console.log("   Estimating gas...");
		forwarder = await MetaTransactionForwarder.deploy();
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

		console.log("   Estimating gas...");
		propertyMarketplace = await PropertyMarketplace.deploy(deployer.address, await forwarder.getAddress());
		console.log("   Transaction sent, waiting for deployment...");
		await propertyMarketplace.waitForDeployment();

		const propertyMarketplaceAddress = await propertyMarketplace.getAddress();
		console.log("✅ PropertyMarketplace deployed to:", propertyMarketplaceAddress);

	} catch (error) {
		console.error("❌ PropertyMarketplace deployment failed:", error.message);
		process.exit(1);
	}

	// Step 3: Deploy BookingManager (needs marketplace, forwarder, EURC, treasury)
	console.log("\n📦 Step 3: Deploying BookingManager...");
	let bookingManager;
	try {
		const BookingManager = await hre.ethers.getContractFactory("BookingManager");
		const propertyMarketplaceAddress = await propertyMarketplace.getAddress();
		const forwarderAddress = await forwarder.getAddress();

		console.log("   PropertyMarketplace:", propertyMarketplaceAddress);
		console.log("   Forwarder:", forwarderAddress);
		console.log("   EURC Token:", EURC_TOKEN_ADDRESS);
		console.log("   Treasury:", treasuryAddress);

		console.log("   Estimating gas...");
		bookingManager = await BookingManager.deploy(
			propertyMarketplaceAddress,
			forwarderAddress,
			EURC_TOKEN_ADDRESS,
			treasuryAddress
		);
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
		network: "baseSepolia",
		chainId: 84532,
		deployer: deployer.address,
		treasury: treasuryAddress,
		deploymentTime: new Date().toISOString(),
		contracts: {
			PropertyMarketplace: propertyMarketplaceAddress,
			BookingManager: bookingManagerAddress,
			MetaTransactionForwarder: forwarderAddress,
			EURCToken: EURC_TOKEN_ADDRESS
		}
	};

	// Save to root contracts folder
	fs.writeFileSync(
		"deployment-base-sepolia.json",
		JSON.stringify(deploymentInfo, null, 2)
	);
	console.log("\n💾 Deployment info saved to: deployment-base-sepolia.json");

	// Also save to backend config folder
	const backendConfigPath = "backend/src/config";
	if (!fs.existsSync(backendConfigPath)) {
		fs.mkdirSync(backendConfigPath, { recursive: true });
	}
	fs.writeFileSync(
		`${backendConfigPath}/deployment-base-sepolia.json`,
		JSON.stringify(deploymentInfo, null, 2)
	);
	console.log(`💾 Deployment info also saved to: ${backendConfigPath}/deployment-base-sepolia.json`);

	// Display final deployment info
	console.log("\n🎉 All Contracts Deployed Successfully!");
	console.log("=====================================");
	console.log("Network: Base Sepolia (Chain ID: 84532)");
	console.log("Deployer:", deployer.address);
	console.log("PropertyMarketplace:", propertyMarketplaceAddress);
	console.log("BookingManager:", bookingManagerAddress);
	console.log("MetaTransactionForwarder:", forwarderAddress);
	console.log("=====================================");

	console.log("\n🔗 View on BaseScan:");
	console.log(`https://sepolia.basescan.org/address/${propertyMarketplaceAddress}`);
	console.log(`https://sepolia.basescan.org/address/${bookingManagerAddress}`);
	console.log(`https://sepolia.basescan.org/address/${forwarderAddress}`);

	// Show environment variables to add to .env
	console.log("\n🔧 Add these to your .env file:");
	console.log(`FORWARDER_ADDRESS=${forwarderAddress}`);
	console.log(`BOOKING_MANAGER_ADDRESS=${bookingManagerAddress}`);
	console.log(`PROPERTY_MARKETPLACE_ADDRESS=${propertyMarketplaceAddress}`);
	console.log(`EURC_TOKEN_ADDRESS=${EURC_TOKEN_ADDRESS}`);
	console.log(`TREASURY_ADDRESS=${treasuryAddress}`);

	// Test the contracts
	console.log("\n🧪 Testing deployed contracts...");
	try {
		// Test PropertyMarketplace
		const feeRecipient = await propertyMarketplace.feeRecipient();
		console.log("✅ PropertyMarketplace: Fee recipient =", feeRecipient);

		// Test BookingManager
		const marketplaceAddress = await bookingManager.propertyMarketplace();
		console.log("✅ BookingManager: PropertyMarketplace =", marketplaceAddress);

		const eurcAddress = await bookingManager.eurcToken();
		console.log("✅ BookingManager: EURC Token =", eurcAddress);

		const treasuryAddr = await bookingManager.treasury();
		console.log("✅ BookingManager: Treasury =", treasuryAddr);

		// Test MetaTransactionForwarder
		const domainSeparator = await forwarder.getDomainSeparator();
		console.log("✅ MetaTransactionForwarder: Domain separator =", domainSeparator);

		console.log("✅ All contracts tested successfully!");

	} catch (error) {
		console.error("❌ Contract testing failed:", error.message);
	}

	console.log("\n🚀 Ready to use meta-transactions on Base Sepolia!");
	console.log("Run: node backend/src/server.js");
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
