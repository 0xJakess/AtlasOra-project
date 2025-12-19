import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Verification script for deployed AtlasOra Token contracts
 *
 * This script reads the latest deployment info and verifies the contract on Basescan
 */
async function main() {
  const networkName = process.env.HARDHAT_NETWORK || "baseSepolia";

  console.log(`\n[VERIFY] Verifying AtlasOra Token contract on ${networkName}...\n`);

  // Read latest deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  const latestFilepath = path.join(
    deploymentsDir,
    `${networkName}-latest.json`
  );

  if (!fs.existsSync(latestFilepath)) {
    throw new Error(
      `No deployment found for ${networkName}. Please deploy first.`
    );
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(latestFilepath, "utf8"));

  console.log("Deployment Information:");
  console.log("----------------------------------------");
  console.log(`Contract Address: ${deploymentInfo.tokenAddress}`);
  console.log(`Network: ${deploymentInfo.network}`);
  console.log("----------------------------------------\n");

  // Parse constructor arguments from deployment info
  const { config } = deploymentInfo;

  const constructorArguments = [
    config.name,
    config.symbol,
    deploymentInfo.deployerAddress,
    config.foundationAddress,
  ];

  console.log("[WAITING] Verifying contract...\n");

  try {
    await run("verify:verify", {
      address: deploymentInfo.tokenAddress,
      constructorArguments,
    });

    console.log("[SUCCESS] Contract verified successfully!\n");

    if (networkName === "base") {
      console.log(
        `[EXPLORER] View on BaseScan: https://basescan.org/address/${deploymentInfo.tokenAddress}`
      );
    } else if (networkName === "baseSepolia") {
      console.log(
        `[EXPLORER] View on BaseScan: https://sepolia.basescan.org/address/${deploymentInfo.tokenAddress}`
      );
    }
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("[INFO] Contract already verified\n");
    } else {
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n[ERROR] Verification failed:\n", error);
    process.exit(1);
  });
