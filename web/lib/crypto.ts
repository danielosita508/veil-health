/**
 * Veil Health Cryptography Library
 * Native WebCrypto implementation (window.crypto.subtle / globalThis.crypto.subtle)
 * - AES-GCM 256 record encryption with 12-byte IV
 * - SHA-256 contentHash calculation (bytes32 hex for Solidity)
 * - ECDH P-256 identity keypairs stored as JWK
 * - Ephemeral ECDH + HKDF (SHA-256) + AES-GCM 256 key wrapping
 */

export interface RecordPlaintext {
  title: string;
  date: string;
  provider: string;
  notes: string;
  vitals?: Record<string, string | number>;
  attachments?: unknown[];
  [key: string]: unknown;
}

export interface EncryptedBlob {
  ciphertext: string; // Base64
  iv: string;         // Base64
  contentHash: string;// 0x-prefixed 32-byte hex string
}

export interface WrappedKeyData {
  ephemeralPub: string; // JSON-stringified JWK
  iv: string;           // Base64 12-byte IV
  wrappedKey: string;   // Base64 wrapped raw AES key
}

export interface IdentityKeyPairJwk {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error("WebCrypto SubtleCrypto is not available in this environment.");
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  throw new Error("crypto.getRandomValues is not available in this environment.");
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ==========================================
// 1. SHA-256 Content Hash
// ==========================================
export async function computeContentHash(
  ciphertextInput: string | Uint8Array
): Promise<string> {
  const subtle = getSubtleCrypto();
  const bytes =
    typeof ciphertextInput === "string"
      ? new TextEncoder().encode(ciphertextInput)
      : ciphertextInput;
  const digest = await subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

// ==========================================
// 2. AES-GCM 256 Record Encryption / Decryption
// ==========================================
export async function generateRecordKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable for key wrapping
    ["encrypt", "decrypt"]
  );
}

export async function exportRawRecordKey(key: CryptoKey): Promise<Uint8Array> {
  const subtle = getSubtleCrypto();
  const raw = await subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function importRawRecordKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return subtle.importKey(
    "raw",
    rawBytes,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptRecord(
  plaintext: RecordPlaintext | string,
  key: CryptoKey
): Promise<EncryptedBlob> {
  const subtle = getSubtleCrypto();
  const jsonStr =
    typeof plaintext === "string" ? plaintext : JSON.stringify(plaintext);
  const data = new TextEncoder().encode(jsonStr);

  const iv = getRandomValues(new Uint8Array(12)); // 12-byte IV for AES-GCM
  const ciphertextBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  const ciphertextBase64 = bytesToBase64(new Uint8Array(ciphertextBuffer));
  const ivBase64 = bytesToBase64(iv);
  const contentHash = await computeContentHash(ciphertextBase64);

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    contentHash,
  };
}

export async function decryptRecord(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<RecordPlaintext> {
  const subtle = getSubtleCrypto();
  const ciphertextBytes = base64ToBytes(ciphertextBase64);
  const ivBytes = base64ToBytes(ivBase64);

  const decryptedBuffer = await subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes
  );

  const text = new TextDecoder().decode(decryptedBuffer);
  try {
    return JSON.parse(text) as RecordPlaintext;
  } catch {
    return { title: "Medical Record", date: "", provider: "", notes: text };
  }
}

// ==========================================
// 3. ECDH P-256 Identity Keypairs
// ==========================================
export async function generateIdentityKeyPair(): Promise<IdentityKeyPairJwk> {
  const subtle = getSubtleCrypto();
  const pair = await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const publicKeyJwk = await subtle.exportKey("jwk", pair.publicKey);
  const privateKeyJwk = await subtle.exportKey("jwk", pair.privateKey);

  return {
    publicKeyJwk,
    privateKeyJwk,
  };
}

export function publicKeyJwkToBytes(jwk: JsonWebKey): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(jwk));
}

export function bytesToPublicKeyJwk(bytes: Uint8Array): JsonWebKey {
  const str = new TextDecoder().decode(bytes);
  return JSON.parse(str) as JsonWebKey;
}

// ==========================================
// 4. Ephemeral ECDH + HKDF + AES-GCM Key Wrapping
// ==========================================
const HKDF_SALT = new Uint8Array(0);
const HKDF_INFO = new TextEncoder().encode("VeilHealth:KeyWrap:v1");

export async function wrapRecordKey(
  recordKey: CryptoKey,
  recipientPublicKeyJwk: JsonWebKey
): Promise<WrappedKeyData> {
  const subtle = getSubtleCrypto();

  // Import recipient's public ECDH key
  const recipientPubKey = await subtle.importKey(
    "jwk",
    recipientPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Generate ephemeral ECDH P-256 keypair
  const ephemeralPair = await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Derive shared secret bits (256 bits)
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: recipientPubKey },
    ephemeralPair.privateKey,
    256
  );

  // Import shared bits into HKDF key
  const hkdfKey = await subtle.importKey(
    "raw",
    sharedBits,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256 wrapping key via HKDF
  const wrappingKey = await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT,
      info: HKDF_INFO,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Export raw record key bytes
  const rawKeyBytes = await exportRawRecordKey(recordKey);

  // Encrypt raw record key with 12-byte IV
  const iv = getRandomValues(new Uint8Array(12));
  const wrappedBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    rawKeyBytes
  );

  // Export ephemeral public key as JWK
  const ephemeralPubJwk = await subtle.exportKey(
    "jwk",
    ephemeralPair.publicKey
  );

  return {
    ephemeralPub: JSON.stringify(ephemeralPubJwk),
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedBuffer)),
  };
}

export async function unwrapRecordKey(
  wrappedData: WrappedKeyData,
  recipientPrivateKeyJwk: JsonWebKey
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();

  // Import recipient's private ECDH key
  const recipientPrivKey = await subtle.importKey(
    "jwk",
    recipientPrivateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );

  // Parse and import ephemeral public key
  const ephemeralPubJwk: JsonWebKey =
    typeof wrappedData.ephemeralPub === "string"
      ? JSON.parse(wrappedData.ephemeralPub)
      : wrappedData.ephemeralPub;

  const ephemeralPubKey = await subtle.importKey(
    "jwk",
    ephemeralPubJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret bits
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: ephemeralPubKey },
    recipientPrivKey,
    256
  );

  // Import shared bits into HKDF key
  const hkdfKey = await subtle.importKey(
    "raw",
    sharedBits,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256 wrapping key via HKDF
  const wrappingKey = await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT,
      info: HKDF_INFO,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Decrypt wrapped key
  const ivBytes = base64ToBytes(wrappedData.iv);
  const wrappedBytes = base64ToBytes(wrappedData.wrappedKey);

  const rawKeyBuffer = await subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    wrappingKey,
    wrappedBytes
  );

  // Import raw key as AES-GCM record key
  return importRawRecordKey(new Uint8Array(rawKeyBuffer));
}

