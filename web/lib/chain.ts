import { ethers } from "ethers";

export const HEALTH_VAULT_ABI = [
  // Admin & Role Registry
  "function setProvider(address account, bool active) external",
  "function setInsurer(address account, bool active) external",
  "function isProvider(address account) external view returns (bool)",
  "function isInsurer(address account) external view returns (bool)",

  // Public Key Registration
  "function registerKey(bytes calldata pubKey) external",
  "function publicKeyOf(address account) external view returns (bytes memory)",

  // Records & Access Control
  "function createRecord(address patient, bytes32 contentHash) external returns (uint256)",
  "function grantAccess(uint256 recordId, address grantee, uint64 expiry) external",
  "function revokeAccess(uint256 recordId, address grantee) external",
  "function hasAccess(uint256 recordId, address who) external view returns (bool)",
  "function logAccess(uint256 recordId) external",
  "function records(uint256 recordId) external view returns (address patient, address provider, bytes32 contentHash, uint64 createdAt)",
  "function accessExpiry(uint256 recordId, address grantee) external view returns (uint64)",

  // Insurance Policies & Claims
  "function createPolicy(address patient, uint256 limitCents, uint16 coveredBitmap) external returns (uint256)",
  "function policies(uint256 policyId) external view returns (address insurer, address patient, uint256 limitCents, uint256 usedCents, uint16 coveredBitmap, bool active)",
  "function submitClaim(uint256 policyId, uint256 recordId, uint8 code, uint256 amountCents, bytes calldata providerSig) external returns (uint256)",
  "function claims(uint256 claimId) external view returns (uint256 policyId, uint256 recordId, address patient, address provider, uint8 code, uint256 amountCents, uint8 status, bytes32 payoutRef, uint64 submittedAt)",
  "function reviewClaim(uint256 claimId, bool approve) external",
  "function markPaid(uint256 claimId, bytes32 payoutRef) external",

  // Events
  "event RecordCreated(uint256 indexed recordId, address indexed patient, address indexed provider, bytes32 contentHash)",
  "event AccessGranted(uint256 indexed recordId, address indexed patient, address indexed grantee, uint64 expiry)",
  "event AccessRevoked(uint256 indexed recordId, address indexed patient, address indexed grantee)",
  "event AccessLogged(uint256 indexed recordId, address indexed caller, uint64 timestamp)",
  "event PolicyCreated(uint256 indexed policyId, address indexed insurer, address indexed patient, uint256 limitCents, uint16 coveredBitmap)",
  "event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId, uint256 indexed recordId, address patient, uint8 code, uint256 amountCents)",
  "event ClaimReviewed(uint256 indexed claimId, bool approved)",
  "event ClaimPaid(uint256 indexed claimId, bytes32 payoutRef)",
  "event KeyRegistered(address indexed account, bytes pubKey)"
] as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
export const HEALTH_VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_HEALTH_VAULT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

let cachedProvider: ethers.JsonRpcProvider | null = null;

export function getBaseSepoliaProvider(): ethers.JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(
      BASE_SEPOLIA_RPC_URL,
      BASE_SEPOLIA_CHAIN_ID,
      { staticNetwork: true }
    );
  }
  return cachedProvider;
}

export function getHealthVaultContract(
  runner?: ethers.ContractRunner
): ethers.Contract {
  const activeRunner = runner || getBaseSepoliaProvider();
  return new ethers.Contract(
    HEALTH_VAULT_ADDRESS,
    HEALTH_VAULT_ABI,
    activeRunner
  );
}

