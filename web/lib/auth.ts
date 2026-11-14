import { ethers } from "ethers";

export interface AuthHeaders {
  "x-address": string;
  "x-ts": string;
  "x-sig": string;
  [key: string]: string;
}

export interface AuthVerificationResult {
  valid: boolean;
  address?: string;
  ts?: number;
  error?: string;
}

/**
 * Builds the canonical message format:
 * VeilHealth:<METHOD>:<path>:<ts>
 */
export function buildAuthMessage(
  method: string,
  path: string,
  ts: number
): string {
  // Normalize method (uppercase) and pathname (strip query params)
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.split("?")[0].trim();
  return `VeilHealth:${normalizedMethod}:${normalizedPath}:${ts}`;
}

/**
 * Client-side: signs the authentication message using an ethers Signer.
 */
export async function createAuthHeaders(
  signer: ethers.Signer,
  method: string,
  path: string,
  timestamp?: number
): Promise<AuthHeaders> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const address = await signer.getAddress();
  const message = buildAuthMessage(method, path, ts);
  const sig = await signer.signMessage(message);

  return {
    "x-address": ethers.getAddress(address),
    "x-ts": ts.toString(),
    "x-sig": sig,
  };
}

/**
 * Server-side: verifies the authentication headers from a Next.js Request.
 * Enforces:
 * 1. Required headers presence (x-address, x-ts, x-sig)
 * 2. 5-minute timestamp validity window
 * 3. Cryptographic signature recovery matching x-address
 */
export function verifyAuthHeaders(
  headers: Headers | Record<string, string | undefined>,
  method: string,
  path: string
): AuthVerificationResult {
  const getHeader = (key: string): string | null => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(key);
    }
    const rec = headers as Record<string, string | undefined>;
    return rec[key] || rec[key.toLowerCase()] || null;
  };

  const xAddress = getHeader("x-address");
  const xTs = getHeader("x-ts");
  const xSig = getHeader("x-sig");

  if (!xAddress || !xTs || !xSig) {
    return {
      valid: false,
      error: "Missing required authentication headers (x-address, x-ts, x-sig).",
    };
  }

  const ts = parseInt(xTs, 10);
  if (isNaN(ts)) {
    return {
      valid: false,
      error: "Invalid timestamp header x-ts.",
    };
  }

  // 5-minute expiry window (300 seconds)
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - ts);
  if (diff > 300) {
    return {
      valid: false,
      error: `Authentication timestamp expired or skewed (${diff}s difference exceeds 300s limit).`,
    };
  }

  if (!ethers.isAddress(xAddress)) {
    return {
      valid: false,
      error: "Invalid Ethereum address in x-address header.",
    };
  }

  const expectedAddress = ethers.getAddress(xAddress);
  const message = buildAuthMessage(method, path, ts);

  try {
    const recoveredAddress = ethers.verifyMessage(message, xSig);
    if (ethers.getAddress(recoveredAddress) !== expectedAddress) {
      return {
        valid: false,
        error: "Signature verification failed: recovered address does not match x-address.",
      };
    }

    return {
      valid: true,
      address: expectedAddress,
      ts,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Failed to verify signature: ${message}`,
    };
  }
}

