import { ethers } from "ethers";
import {
  generateIdentityKeyPair,
  IdentityKeyPairJwk,
} from "./crypto";

export type Role = "patient" | "provider" | "insurer";

export interface RoleIdentity {
  role: Role;
  address: string;
  privateKey: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  createdAt: number;
}

export interface FullIdentityBundle {
  version: number;
  warning: string;
  exportedAt: string;
  identities: Partial<Record<Role, RoleIdentity>>;
}

const STORAGE_PREFIX = "veil_health_identity_";

export function getIdentityStorageKey(role: Role): string {
  return `${STORAGE_PREFIX}${role}`;
}

export function getStoredIdentity(role: Role): RoleIdentity | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  const raw = window.localStorage.getItem(getIdentityStorageKey(role));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoleIdentity;
  } catch (err) {
    console.error(`Failed to parse stored identity for role ${role}:`, err);
    return null;
  }
}

export function saveIdentity(role: Role, identity: RoleIdentity): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(
    getIdentityStorageKey(role),
    JSON.stringify(identity)
  );
}

export function clearIdentity(role: Role): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(getIdentityStorageKey(role));
}

export async function getOrCreateIdentity(role: Role): Promise<RoleIdentity> {
  const existing = getStoredIdentity(role);
  if (existing) {
    return existing;
  }

  // Generate new burner wallet
  const wallet = ethers.Wallet.createRandom();

  // Generate ECDH P-256 identity keypair
  const keyPair = await generateIdentityKeyPair();

  const newIdentity: RoleIdentity = {
    role,
    address: wallet.address,
    privateKey: wallet.privateKey,
    publicKeyJwk: keyPair.publicKeyJwk,
    privateKeyJwk: keyPair.privateKeyJwk,
    createdAt: Date.now(),
  };

  saveIdentity(role, newIdentity);
  return newIdentity;
}

export function getWalletForIdentity(
  identity: RoleIdentity,
  provider?: ethers.Provider
): ethers.Wallet {
  return new ethers.Wallet(identity.privateKey, provider);
}

export function exportIdentityBundle(): string {
  const bundle: FullIdentityBundle = {
    version: 1,
    warning:
      "DEMO IDENTITIES ONLY - NEVER SEND REAL FUNDS TO THESE ADDRESSES OR SHARE SENSITIVE KEYS",
    exportedAt: new Date().toISOString(),
    identities: {
      patient: getStoredIdentity("patient") || undefined,
      provider: getStoredIdentity("provider") || undefined,
      insurer: getStoredIdentity("insurer") || undefined,
    },
  };

  return JSON.stringify(bundle, null, 2);
}

export function importIdentityBundle(jsonStr: string): {
  success: boolean;
  importedRoles: Role[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonStr) as FullIdentityBundle;
    if (!parsed || !parsed.identities) {
      return { success: false, importedRoles: [], error: "Invalid identity bundle format." };
    }

    const importedRoles: Role[] = [];
    const roles: Role[] = ["patient", "provider", "insurer"];

    for (const r of roles) {
      const id = parsed.identities[r];
      if (id && id.address && id.privateKey && id.publicKeyJwk && id.privateKeyJwk) {
        saveIdentity(r, {
          role: r,
          address: id.address,
          privateKey: id.privateKey,
          publicKeyJwk: id.publicKeyJwk,
          privateKeyJwk: id.privateKeyJwk,
          createdAt: id.createdAt || Date.now(),
        });
        importedRoles.push(r);
      }
    }

    return { success: true, importedRoles };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, importedRoles: [], error: message };
  }
}

