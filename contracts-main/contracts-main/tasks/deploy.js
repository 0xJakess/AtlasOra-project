const { task } = require("hardhat/config");

task("deploy", "Deploys the property rental system contracts")
	.addParam("feeRecipient", "Address that will receive platform fees")
	.addParam("forwarder", "Trusted forwarder address for ERC2771Context")
	.setAction(async (taskArgs, hre) => {
		const [deployer] = await hre.ethers.getSigners();
		
		console.log("Deploying contracts with the account:", deployer.address);
		console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
		console.log("Fee recipient:", taskArgs.feeRecipient);
		console.log("Trusted forwarder:", taskArgs.forwarder);
		
		// Deploy PropertyMarketplace first
		console.log("Deploying PropertyMarketplace...");
		const PropertyMarketplace = await hre.ethers.getContractFactory("PropertyMarketplace");
		const propertyMarketplace = await PropertyMarketplace.deploy(taskArgs.feeRecipient, taskArgs.forwarder);
		await propertyMarketplace.waitForDeployment();
		
		const propertyMarketplaceAddress = await propertyMarketplace.getAddress();
		console.log("PropertyMarketplace deployed to:", propertyMarketplaceAddress);
		
		// Deploy BookingManager
		console.log("Deploying BookingManager...");
		const BookingManager = await hre.ethers.getContractFactory("BookingManager");
		const bookingManager = await BookingManager.deploy(propertyMarketplaceAddress, taskArgs.forwarder);
		await bookingManager.waitForDeployment();
		
		const bookingManagerAddress = await bookingManager.getAddress();
		console.log("BookingManager deployed to:", bookingManagerAddress);
		
		console.log("Deployment complete!");
		console.log("Network:", hre.network.name);
		console.log("PropertyMarketplace:", propertyMarketplaceAddress);
		console.log("BookingManager:", bookingManagerAddress);
		
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
					constructorArguments: [taskArgs.feeRecipient, taskArgs.forwarder],
				});
				console.log("PropertyMarketplace verified successfully");
				
				await hre.run("verify:verify", {
					address: bookingManagerAddress,
					constructorArguments: [propertyMarketplaceAddress, taskArgs.forwarder],
				});
				console.log("BookingManager verified successfully");
			} catch (error) {
				console.error("Error verifying contracts:", error);
			}
		}
		
		return {
			propertyMarketplace: propertyMarketplaceAddress,
			bookingManager: bookingManagerAddress
		};
	}); 