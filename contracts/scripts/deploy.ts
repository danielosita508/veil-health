import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HealthVault with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const HealthVaultFactory = await ethers.getContractFactory("HealthVault");
  const vault = await HealthVaultFactory.deploy();
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("----------------------------------------------------");
  console.log("HealthVault successfully deployed to:", vaultAddress);
  console.log("----------------------------------------------------");
  console.log("Add this address to your web/.env:");
  console.log(`NEXT_PUBLIC_HEALTH_VAULT_ADDRESS=${vaultAddress}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
