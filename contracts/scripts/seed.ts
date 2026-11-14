import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding Veil Health with deployer account:", deployer.address);

  const vaultAddress =
    process.env.HEALTH_VAULT_ADDRESS ||
    process.env.NEXT_PUBLIC_HEALTH_VAULT_ADDRESS;

  if (!vaultAddress || !ethers.isAddress(vaultAddress)) {
    throw new Error(
      "Missing or invalid HEALTH_VAULT_ADDRESS environment variable."
    );
  }

  const vault = await ethers.getContractAt("HealthVault", vaultAddress, deployer);

  // Default demo addresses or from environment
  const demoProviderAddress =
    process.env.SEED_PROVIDER_ADDRESS ||
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const demoInsurerAddress =
    process.env.SEED_INSURER_ADDRESS ||
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const demoPatientAddress =
    process.env.SEED_PATIENT_ADDRESS ||
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  console.log("\n1. Registering Roles...");
  const tx1 = await vault.setProvider(demoProviderAddress, true);
  await tx1.wait();
  console.log(`   Provider registered: ${demoProviderAddress}`);

  const tx2 = await vault.setInsurer(demoInsurerAddress, true);
  await tx2.wait();
  console.log(`   Insurer registered:  ${demoInsurerAddress}`);

  console.log("\n2. Checking Balances and Funding Roles...");
  const fundAmount = ethers.parseEther("0.01");
  for (const [name, addr] of [
    ["Provider", demoProviderAddress],
    ["Insurer", demoInsurerAddress],
    ["Patient", demoPatientAddress],
  ]) {
    const bal = await ethers.provider.getBalance(addr);
    if (bal < ethers.parseEther("0.005")) {
      console.log(`   Funding ${name} (${addr}) with 0.01 ETH...`);
      const txFund = await deployer.sendTransaction({
        to: addr,
        value: fundAmount,
      });
      await txFund.wait();
    } else {
      console.log(`   ${name} already funded (${ethers.formatEther(bal)} ETH)`);
    }
  }

  console.log("\n3. Creating Demo Insurance Policy...");
  // Bitmap 0b00000011 covers ProcedureCode.OUTPATIENT (0) and LAB (1)
  const coveredBitmap = 3;
  const policyLimitCents = 500000n; // $5,000.00 limit

  // Try creating policy using insurer if key available, or log instructions
  const insurerKey = process.env.INSURER_PRIVATE_KEY;
  if (insurerKey) {
    const insurerSigner = new ethers.Wallet(insurerKey, ethers.provider);
    const vaultAsInsurer = vault.connect(insurerSigner);
    const txPolicy = await vaultAsInsurer.createPolicy(
      demoPatientAddress,
      policyLimitCents,
      coveredBitmap
    );
    const receipt = await txPolicy.wait();
    console.log(`   Sample policy created! Tx: ${receipt?.hash}`);
  } else {
    console.log(
      `   Note: To create policy automatically, set INSURER_PRIVATE_KEY. Otherwise, log in as Insurer on the web dashboard to create policy for Patient (${demoPatientAddress}).`
    );
  }

  console.log("\nSeed completed successfully!");
}

main().catch((error) => {
  console.error("Seed script failed:", error);
  process.exitCode = 1;
});
