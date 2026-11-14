import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HealthVault } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("HealthVault", function () {
  let vault: HealthVault;
  let owner: HardhatEthersSigner;
  let provider: HardhatEthersSigner;
  let rogueProvider: HardhatEthersSigner;
  let insurer: HardhatEthersSigner;
  let rogueInsurer: HardhatEthersSigner;
  let patient: HardhatEthersSigner;
  let doctorGrantee: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;
  let chainId: bigint;

  // Procedure codes: 0: OUTPATIENT, 1: LAB, 2: IMAGING, 3: SPECIALIST
  // Bitmaps: 1 | 2 = 3 (covers OUTPATIENT and LAB)
  const COVERED_BITMAP = 0b00000011; // codes 0 and 1 covered
  const POLICY_LIMIT = 500000n; // $5,000.00 (in cents)

  beforeEach(async function () {
    [
      owner,
      provider,
      rogueProvider,
      insurer,
      rogueInsurer,
      patient,
      doctorGrantee,
      outsider,
    ] = await ethers.getSigners();

    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;

    const HealthVaultFactory = await ethers.getContractFactory("HealthVault");
    vault = await HealthVaultFactory.deploy();
    await vault.waitForDeployment();

    // Register approved provider and insurer
    await vault.connect(owner).setProvider(provider.address, true);
    await vault.connect(owner).setInsurer(insurer.address, true);
  });

  async function createAttestation(
    signer: HardhatEthersSigner,
    patientAddr: string,
    recordId: bigint,
    code: number,
    amountCents: bigint
  ): Promise<string> {
    const vaultAddr = await vault.getAddress();
    const digest = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "address", "uint256", "uint8", "uint256"],
        [vaultAddr, chainId, patientAddr, recordId, code, amountCents]
      )
    );
    return signer.signMessage(ethers.getBytes(digest));
  }

  describe("Role Gating & Administration", function () {
    it("allows only owner to set provider and insurer", async function () {
      await expect(
        vault.connect(outsider).setProvider(outsider.address, true)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

      await expect(
        vault.connect(outsider).setInsurer(outsider.address, true)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

      expect(await vault.isProvider(provider.address)).to.be.true;
      expect(await vault.isInsurer(insurer.address)).to.be.true;
    });

    it("allows registering public encryption keys", async function () {
      const pubKey = ethers.toUtf8Bytes("demo-ecdh-p256-key");
      await expect(vault.connect(patient).registerKey(pubKey))
        .to.emit(vault, "KeyRegistered")
        .withArgs(patient.address, pubKey);

      expect(await vault.publicKeyOf(patient.address)).to.equal(
        ethers.hexlify(pubKey)
      );
    });
  });

  describe("Records & Access Control", function () {
    const dummyHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext-1"));

    it("allows only registered providers to create records", async function () {
      await expect(
        vault.connect(outsider).createRecord(patient.address, dummyHash)
      ).to.be.revertedWithCustomError(vault, "OnlyProvider");

      await expect(vault.connect(provider).createRecord(patient.address, dummyHash))
        .to.emit(vault, "RecordCreated")
        .withArgs(1n, patient.address, provider.address, dummyHash);

      const rec = await vault.records(1n);
      expect(rec.patient).to.equal(patient.address);
      expect(rec.provider).to.equal(provider.address);
      expect(rec.contentHash).to.equal(dummyHash);
    });

    it("evaluates hasAccess for patient and provider immediately", async function () {
      await vault.connect(provider).createRecord(patient.address, dummyHash);

      expect(await vault.hasAccess(1n, patient.address)).to.be.true;
      expect(await vault.hasAccess(1n, provider.address)).to.be.true;
      expect(await vault.hasAccess(1n, doctorGrantee.address)).to.be.false;
      expect(await vault.hasAccess(1n, outsider.address)).to.be.false;
    });

    it("grants access with valid expiry up to 30 days and enforces time travel expiration", async function () {
      await vault.connect(provider).createRecord(patient.address, dummyHash);

      const now = await time.latest();
      const oneHour = 3600;
      const expiry = BigInt(now + oneHour);

      // Only patient can grant
      await expect(
        vault.connect(provider).grantAccess(1n, doctorGrantee.address, expiry)
      ).to.be.revertedWithCustomError(vault, "OnlyPatient");

      // Cannot grant more than 30 days ahead
      const thirtyOneDays = BigInt(now + 31 * 24 * 3600);
      await expect(
        vault.connect(patient).grantAccess(1n, doctorGrantee.address, thirtyOneDays)
      ).to.be.revertedWithCustomError(vault, "InvalidExpiry");

      // Valid grant
      await expect(
        vault.connect(patient).grantAccess(1n, doctorGrantee.address, expiry)
      )
        .to.emit(vault, "AccessGranted")
        .withArgs(1n, patient.address, doctorGrantee.address, expiry);

      expect(await vault.hasAccess(1n, doctorGrantee.address)).to.be.true;

      // Time travel: forward 3601 seconds (past expiry)
      await time.increase(oneHour + 1);
      expect(await vault.hasAccess(1n, doctorGrantee.address)).to.be.false;
    });

    it("allows patient to revoke access before expiry", async function () {
      await vault.connect(provider).createRecord(patient.address, dummyHash);

      const now = await time.latest();
      const expiry = BigInt(now + 86400); // 1 day

      await vault.connect(patient).grantAccess(1n, doctorGrantee.address, expiry);
      expect(await vault.hasAccess(1n, doctorGrantee.address)).to.be.true;

      // Non-patient cannot revoke
      await expect(
        vault.connect(outsider).revokeAccess(1n, doctorGrantee.address)
      ).to.be.revertedWithCustomError(vault, "OnlyPatient");

      // Patient revokes
      await expect(vault.connect(patient).revokeAccess(1n, doctorGrantee.address))
        .to.emit(vault, "AccessRevoked")
        .withArgs(1n, patient.address, doctorGrantee.address);

      expect(await vault.hasAccess(1n, doctorGrantee.address)).to.be.false;
    });

    it("emits AccessLogged when authorized non-patient logs access", async function () {
      await vault.connect(provider).createRecord(patient.address, dummyHash);

      // Patient calling logAccess reverts Unauthorized (log is for grantees)
      await expect(vault.connect(patient).logAccess(1n)).to.be.revertedWithCustomError(
        vault,
        "Unauthorized"
      );

      // Outsider without access reverts Unauthorized
      await expect(vault.connect(outsider).logAccess(1n)).to.be.revertedWithCustomError(
        vault,
        "Unauthorized"
      );

      // Provider has access and logs
      await expect(vault.connect(provider).logAccess(1n)).to.emit(
        vault,
        "AccessLogged"
      );
    });
  });

  describe("Insurance Policies & Claims Flow", function () {
    const dummyHash = ethers.keccak256(ethers.toUtf8Bytes("visit-record"));
    const claimAmount = 15000n; // $150.00
    const coveredCode = 0; // OUTPATIENT

    beforeEach(async function () {
      // Create visit record #1
      await vault.connect(provider).createRecord(patient.address, dummyHash);

      // Create policy #1
      await vault
        .connect(insurer)
        .createPolicy(patient.address, POLICY_LIMIT, COVERED_BITMAP);
    });

    it("allows only insurers to create policies", async function () {
      await expect(
        vault
          .connect(outsider)
          .createPolicy(patient.address, POLICY_LIMIT, COVERED_BITMAP)
      ).to.be.revertedWithCustomError(vault, "OnlyInsurer");
    });

    it("successfully submits claim with valid provider attestation", async function () {
      const sig = await createAttestation(
        provider,
        patient.address,
        1n,
        coveredCode,
        claimAmount
      );

      await expect(
        vault.connect(patient).submitClaim(1n, 1n, coveredCode, claimAmount, sig)
      )
        .to.emit(vault, "ClaimSubmitted")
        .withArgs(1n, 1n, 1n, patient.address, coveredCode, claimAmount);

      const clm = await vault.claims(1n);
      expect(clm.status).to.equal(0); // Submitted
      expect(clm.amountCents).to.equal(claimAmount);
      expect(clm.provider).to.equal(provider.address);
    });

    it("reverts claim submission if signer is not the record's provider", async function () {
      // rogueProvider is not registered and not the provider of record #1
      const sig = await createAttestation(
        rogueProvider,
        patient.address,
        1n,
        coveredCode,
        claimAmount
      );

      await expect(
        vault.connect(patient).submitClaim(1n, 1n, coveredCode, claimAmount, sig)
      ).to.be.revertedWithCustomError(vault, "InvalidAttestationSignature");
    });

    it("reverts claim submission if amount is tampered (signature mismatch)", async function () {
      const realAmount = 15000n;
      const tamperedAmount = 25000n;

      // Attestation signed for $150.00
      const sig = await createAttestation(
        provider,
        patient.address,
        1n,
        coveredCode,
        realAmount
      );

      // Patient attempts to submit with $250.00
      await expect(
        vault.connect(patient).submitClaim(1n, 1n, coveredCode, tamperedAmount, sig)
      ).to.be.revertedWithCustomError(vault, "InvalidAttestationSignature");
    });

    it("reverts claim submission if procedure code is not covered by policy", async function () {
      const uncoveredCode = 4; // PHARMACY (bitmap only covers 0 & 1)
      const sig = await createAttestation(
        provider,
        patient.address,
        1n,
        uncoveredCode,
        claimAmount
      );

      await expect(
        vault.connect(patient).submitClaim(1n, 1n, uncoveredCode, claimAmount, sig)
      ).to.be.revertedWithCustomError(vault, "ProcedureNotCovered");
    });

    it("reverts claim submission if amount exceeds policy limit", async function () {
      const excessAmount = POLICY_LIMIT + 1n;
      const sig = await createAttestation(
        provider,
        patient.address,
        1n,
        coveredCode,
        excessAmount
      );

      await expect(
        vault.connect(patient).submitClaim(1n, 1n, coveredCode, excessAmount, sig)
      ).to.be.revertedWithCustomError(vault, "PolicyLimitExceeded");
    });

    it("reverts duplicate claims for the same record", async function () {
      const sig = await createAttestation(
        provider,
        patient.address,
        1n,
        coveredCode,
        claimAmount
      );

      await vault.connect(patient).submitClaim(1n, 1n, coveredCode, claimAmount, sig);

      // Attempt second claim for record 1
      await expect(
        vault.connect(patient).submitClaim(1n, 1n, coveredCode, claimAmount, sig)
      ).to.be.revertedWithCustomError(vault, "RecordAlreadyClaimed");
    });

    it("completes the full review and markPaid lifecycle", async function () {
      const sig = await createAttestation(
        provider,
        patient.address,
        1n,
        coveredCode,
        claimAmount
      );
      await vault.connect(patient).submitClaim(1n, 1n, coveredCode, claimAmount, sig);

      // Non-insurer cannot review
      await expect(
        vault.connect(outsider).reviewClaim(1n, true)
      ).to.be.revertedWithCustomError(vault, "OnlyInsurer");

      // Insurer approves
      await expect(vault.connect(insurer).reviewClaim(1n, true))
        .to.emit(vault, "ClaimReviewed")
        .withArgs(1n, true);

      let clm = await vault.claims(1n);
      expect(clm.status).to.equal(1); // Approved

      let pol = await vault.policies(1n);
      expect(pol.usedCents).to.equal(claimAmount);

      // Cannot mark paid if not insurer
      const payoutRef = ethers.keccak256(ethers.toUtf8Bytes("VH-CLAIM-1"));
      await expect(
        vault.connect(outsider).markPaid(1n, payoutRef)
      ).to.be.revertedWithCustomError(vault, "OnlyInsurer");

      // Insurer marks paid
      await expect(vault.connect(insurer).markPaid(1n, payoutRef))
        .to.emit(vault, "ClaimPaid")
        .withArgs(1n, payoutRef);

      clm = await vault.claims(1n);
      expect(clm.status).to.equal(3); // Paid
      expect(clm.payoutRef).to.equal(payoutRef);
    });

    it("handles claim rejection and prevents paying rejected claim", async function () {
      const sig = await createAttestation(
        provider,
        patient.address,
        1n,
        coveredCode,
        claimAmount
      );
      await vault.connect(patient).submitClaim(1n, 1n, coveredCode, claimAmount, sig);

      // Insurer rejects
      await expect(vault.connect(insurer).reviewClaim(1n, false))
        .to.emit(vault, "ClaimReviewed")
        .withArgs(1n, false);

      const clm = await vault.claims(1n);
      expect(clm.status).to.equal(2); // Rejected

      // Policy usedCents remains 0
      const pol = await vault.policies(1n);
      expect(pol.usedCents).to.equal(0n);

      // Cannot mark paid when rejected
      const payoutRef = ethers.keccak256(ethers.toUtf8Bytes("VH-CLAIM-1"));
      await expect(
        vault.connect(insurer).markPaid(1n, payoutRef)
      ).to.be.revertedWithCustomError(vault, "InvalidClaimStatus");
    });
  });
});
