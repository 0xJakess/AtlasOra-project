// We require the Hardhat Runtime Environment explicitly here
const hre = require("hardhat");

async function main() {
	const [deployer] = await hre.ethers.getSigners();
	
	console.log("Deploying contracts with the account:", deployer.address);
	console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
	
	// Deploy PropertyMarketplace first
	console.log("Deploying PropertyMarketplace...");
	const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
	const propertyMarketplace = await PropertyMarketplace.deploy(deployer.address);
	await propertyMarketplace.waitForDeployment();
	
	const propertyMarketplaceAddress = await propertyMarketplace.getAddress();
	console.log("PropertyMarketplace deployed to:", propertyMarketplaceAddress);
	
	// Deploy BookingManager
	console.log("Deploying BookingManager...");
	const BookingManager = await hre.ethers.getContractFactory("BookingManager");
	const bookingManager = await BookingManager.deploy(propertyMarketplaceAddress);
	await bookingManager.waitForDeployment();
	
	const bookingManagerAddress = await bookingManager.getAddress();
	console.log("BookingManager deployed to:", bookingManagerAddress);
	
	// Deploy MetaTransactionForwarder
	console.log("Deploying MetaTransactionForwarder...");
	const MetaTransactionForwarder = await hre.ethers.getContractFactory("MetaTransactionForwarder");
	const forwarder = await MetaTransactionForwarder.deploy();
	await forwarder.waitForDeployment();
	
	const forwarderAddress = await forwarder.getAddress();
	console.log("MetaTransactionForwarder deployed to:", forwarderAddress);
	
	console.log("Deployment complete!");
	console.log("PropertyMarketplace:", propertyMarketplaceAddress);
	console.log("BookingManager:", bookingManagerAddress);
	console.log("MetaTransactionForwarder:", forwarderAddress);
	
	// Wait for confirmations if not on a local network
	if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
		console.log("Waiting for confirmations...");
		await propertyMarketplace.deploymentTransaction().wait(5);
		await bookingManager.deploymentTransaction().wait(5);
		
		// Verify contracts
		console.log("Verifying contracts on Etherscan/Arbiscan...");
		try {
			await hre.run("verify:verify", {
				address: propertyMarketplaceAddress,
				constructorArguments: [deployer.address],
			});
			console.log("PropertyMarketplace verified successfully");
			
			await hre.run("verify:verify", {
				address: bookingManagerAddress,
				constructorArguments: [propertyMarketplaceAddress],
			});
			console.log("BookingManager verified successfully");
			
			await hre.run("verify:verify", {
				address: forwarderAddress,
				constructorArguments: [],
			});
			console.log("MetaTransactionForwarder verified successfully");
		} catch (error) {
			console.error("Error verifying contracts:", error);
		}
	}
}

// Execute deploy function
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	}); 