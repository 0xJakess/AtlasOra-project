import { type TransactionResponse } from "ethers";
import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TOKEN_CONFIG } from "../config/token.config";

interface DeploymentInfo {
	network: string;
	chainId: number;
	tokenAddress: string;
	deployerAddress: string;
	transactionHash: string;
	blockNumber: number;
	timestamp: number;
	config: typeof TOKEN_CONFIG;
	gasUsed: string;
	deploymentCost: string;
}

/**
 * Saves deployment information to a JSON file
 */
async function saveDeploymentInfo(info: DeploymentInfo): Promise<void> {
	const deploymentsDir = path.join(__dirname, "../deployments");
	if (!fs.existsSync(deploymentsDir)) {
		fs.mkdirSync(deploymentsDir, { recursive: true });
	}

	const filename = `${info.network}-${Date.now()}.json`;
	const filepath = path.join(deploymentsDir, filename);

	fs.writeFileSync(filepath, JSON.stringify(info, null, 2));
	console.log(`\n[INFO] Deployment info saved to: ${filepath}`);

	// Also save a "latest" file for easy reference
	const latestFilepath = path.join(deploymentsDir, `${info.network}-latest.json`);
	fs.writeFileSync(latestFilepath, JSON.stringify(info, null, 2));
	console.log(`[INFO] Latest deployment info saved to: ${latestFilepath}`);
}

/**
 * Waits for a specified number of block confirmations
 */
async function waitForConfirmations(
	txResponse: TransactionResponse,
	confirmations: number = 5
): Promise<void> {
	console.log(`\n[WAITING] Waiting for ${confirmations} confirmations...`);
	const receipt = await txResponse.wait(confirmations);
	if (!receipt) {
		throw new Error("Transaction receipt not found during confirmation wait");
	}
	console.log(`[SUCCESS] Transaction confirmed after ${confirmations} blocks`);
}

/**
 * Main deployment function
 */
async function main() {
	console.log("\n========================================");
	console.log("Starting AtlasOra Token Deployment");
	console.log("========================================\n");

	// Get network information
	const networkName = network.name;
	const chainId = (await ethers.provider.getNetwork()).chainId;

	console.log("Deployment Configuration:");
	console.log("----------------------------------------");
	console.log(`Network: ${networkName}`);
	console.log(`Chain ID: ${chainId}`);
	console.log(`Token Name: ${TOKEN_CONFIG.name}`);
	console.log(`Token Symbol: ${TOKEN_CONFIG.symbol}`);
	console.log(`Decimals: ${TOKEN_CONFIG.decimals}`);
	console.log(`Initial Supply (15%): ${TOKEN_CONFIG.initialSupply} tokens`);
	console.log(`Maximum Supply: ${TOKEN_CONFIG.maxSupply} tokens`);
	console.log(`Burnable: ${TOKEN_CONFIG.burnable}`);
	console.log(`Foundation Address: ${TOKEN_CONFIG.foundationAddress}`);
	console.log("----------------------------------------\n");

	console.log("Emission Schedule:");
	console.log("----------------------------------------");
	console.log("Deployment: 15% (30,000,000 tokens) - to deployer");
	console.log("Cycles 1-8: 10% each (20,000,000 tokens) - every 6 months");
	console.log("Cycle 9: 5% (10,000,000 tokens) - final emission");
	console.log("Total: 100% (200,000,000 tokens)");
	console.log("----------------------------------------\n");

	// Get deployer information
	const [deployer] = await ethers.getSigners();
	const deployerAddress = await deployer.getAddress();
	const balance = await ethers.provider.getBalance(deployerAddress);

	console.log("Deployer Information:");
	console.log("----------------------------------------");
	console.log(`Address: ${deployerAddress}`);
	console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
	console.log("----------------------------------------\n");

	// Deploy the token contract
	console.log("[DEPLOYING] Deploying AtlasOra Token contract...\n");

	const AtlasOraToken = await ethers.getContractFactory("AtlasOraToken");
	const token = await AtlasOraToken.deploy(
		TOKEN_CONFIG.name,
		TOKEN_CONFIG.symbol,
		deployerAddress,
		TOKEN_CONFIG.foundationAddress
	);

	await token.waitForDeployment();

	const tokenAddress = await token.target;
	const deploymentTx = token.deploymentTransaction();

	if (!deploymentTx) {
		throw new Error("Deployment transaction not found");
	}

	const receipt = await deploymentTx.wait();

	if (!receipt) {
		throw new Error("Deployment receipt not found");
	}

	console.log("\n[SUCCESS] Token deployed successfully!\n");
	console.log("Deployment Summary:");
	console.log("----------------------------------------");
	console.log(`Contract Address: ${tokenAddress}`);
	console.log(`Transaction Hash: ${deploymentTx.hash}`);
	console.log(`Block Number: ${receipt.blockNumber}`);
	console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

	// Calculate deployment cost (EIP-1559 compatible)
	const deploymentTxReceipt = await ethers.provider.getTransaction(deploymentTx.hash);
	const gasPrice = deploymentTxReceipt?.gasPrice || 0n;
	const deploymentCost = receipt.gasUsed * gasPrice;
	console.log(
		`Deployment Cost: ${ethers.formatEther(deploymentCost)} ETH`
	);
	console.log("----------------------------------------\n");

	if (networkName !== "hardhat" && networkName !== "localhost") {
		await waitForConfirmations(deploymentTx, 5);
	}
	const deploymentInfo: DeploymentInfo = {
		network: networkName,
		chainId: Number(chainId),
		tokenAddress: tokenAddress.toString(),
		deployerAddress,
		transactionHash: deploymentTx.hash,
		blockNumber: receipt.blockNumber,
		timestamp: Date.now(),
		config: TOKEN_CONFIG,
		gasUsed: receipt.gasUsed.toString(),
		deploymentCost: ethers.formatEther(deploymentCost),
	};

	await saveDeploymentInfo(deploymentInfo);
	if (
		(networkName === "base" || networkName === "baseSepolia") &&
		process.env.BASESCAN_API_KEY
	) {
		console.log("\n[VERIFY] Starting contract verification...");
		console.log("[WAITING] Waiting 30 seconds before verification...\n");
		await new Promise((resolve) => setTimeout(resolve, 30000));

		try {
			await run("verify:verify", {
				address: tokenAddress,
				constructorArguments: [
					TOKEN_CONFIG.name,
					TOKEN_CONFIG.symbol,
					deployerAddress,
					TOKEN_CONFIG.foundationAddress,
				],
			});
			console.log("[SUCCESS] Contract verified successfully!");
		} catch (error: any) {
			if (error.message.includes("Already Verified")) {
				console.log("[INFO] Contract already verified");
			} else {
				console.error("[ERROR] Verification failed:", error.message);
				console.log(
					"\n[INFO] You can verify manually later using: npm run verify:" +
						networkName
				);
			}
		}
	}
	if (networkName === "base") {
		console.log(
			`\n[EXPLORER] View on BaseScan: https://basescan.org/address/${tokenAddress}`
		);
	} else if (networkName === "baseSepolia") {
		console.log(
			`\n[EXPLORER] View on BaseScan: https://sepolia.basescan.org/address/${tokenAddress}`
		);
	}

	console.log("\n========================================");
	console.log("Deployment Complete!");
	console.log("========================================\n");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n[ERROR] Deployment failed:\n", error);
    process.exit(1);
  });
