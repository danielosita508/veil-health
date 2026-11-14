import { ethers } from "ethers";
import { ZcashAdapter, ZcashMode } from "./adapter";
import { ManualZcashAdapter } from "./manual";
import { SimZcashAdapter } from "./sim";
import { WebZjsAdapter } from "./webzjs";

export * from "./adapter";
export * from "./manual";
export * from "./sim";
export * from "./webzjs";

// Global singleton instances
const manualAdapter = new ManualZcashAdapter();
const simAdapter = new SimZcashAdapter();
const liveAdapter = new WebZjsAdapter();

/**
 * Returns the active Zcash adapter.
 * Default fallback is "manual" (or "sim" if explicitly configured in environment).
 */
export function getZcashAdapter(requestedMode?: ZcashMode): ZcashAdapter {
  const mode =
    requestedMode ||
    (process.env.NEXT_PUBLIC_ZCASH_MODE as ZcashMode) ||
    "manual";

  switch (mode) {
    case "live":
      return liveAdapter;
    case "sim":
      return simAdapter;
    case "manual":
    default:
      return manualAdapter;
  }
}

/**
 * Computes on-chain payoutRef from memo:
 * payoutRef = keccak256(utf8 memo string)
 */
export function computePayoutRef(memo: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(memo));
}

/**
 * Verifies that the received Zcash memo matches the on-chain payoutRef.
 */
export function verifyClaimPayout(
  memo: string,
  onChainPayoutRef: string
): boolean {
  if (!memo || !onChainPayoutRef) return false;
  const computed = computePayoutRef(memo);
  return computed.toLowerCase() === onChainPayoutRef.toLowerCase();
}
