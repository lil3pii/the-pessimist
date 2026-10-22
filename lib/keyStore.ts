"use client";

import localforage from "localforage";
import type { ProviderId } from "@/lib/providers";

const VAULT_STORE = "pessimist-vault";
const DEVICE_SECRET_ID = "__device_secret__";
const PBKDF2_ITERATIONS = 210_000;
const SALT = "the-pessimist/byok/v1";

const vault = localforage.createInstance({
  name: "the-pessimist",
  storeName: VAULT_STORE,
  description: "Encrypted BYOK material. Ciphertext only.",
});

interface StoredKeyEnvelope {
  version: 1;
  providerId: ProviderId;
  iv: string;
  ciphertext: string;
  createdAt: number;
}

let derivedKeyPromise: Promise<CryptoKey> | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function requireCrypto(): SubtleCrypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable. The key vault requires a secure browser context (HTTPS or localhost).");
  }
  return window.crypto.subtle;
}

async function getDeviceSecret(): Promise<Uint8Array> {
  const existing = await vault.getItem<string>(DEVICE_SECRET_ID);
  if (existing) return base64ToBytes(existing);

  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);
  await vault.setItem(DEVICE_SECRET_ID, bytesToBase64(secret));
  return secret;
}

async function getDerivedKey(): Promise<CryptoKey> {
  if (derivedKeyPromise) return derivedKeyPromise;

  derivedKeyPromise = (async () => {
    const subtle = requireCrypto();
    const secret = await getDeviceSecret();
    const material = await subtle.importKey("raw", asBufferSource(secret), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(SALT),
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  })();

  return derivedKeyPromise;
}

export async function saveApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("Cannot store an empty API key.");
  if (trimmed.length > 5000) throw new Error("API key is implausibly long.");

  const subtle = requireCrypto();
  const key = await getDerivedKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(trimmed),
  );

  const envelope: StoredKeyEnvelope = {
    version: 1,
    providerId,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    createdAt: Date.now(),
  };

  await vault.setItem(`key:${providerId}`, envelope);
}

export async function getApiKey(providerId: ProviderId): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const envelope = await vault.getItem<StoredKeyEnvelope>(`key:${providerId}`);
  if (!envelope || envelope.version !== 1) return null;

  try {
    const subtle = requireCrypto();
    const key = await getDerivedKey();
    const plaintext = await subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(base64ToBytes(envelope.iv)) },
      key,
      asBufferSource(base64ToBytes(envelope.ciphertext)),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // A corrupted envelope or a changed device secret must not brick settings.
    await vault.removeItem(`key:${providerId}`);
    return null;
  }
}

export async function hasApiKey(providerId: ProviderId): Promise<boolean> {
  const key = await getApiKey(providerId);
  return Boolean(key);
}

export async function deleteApiKey(providerId: ProviderId): Promise<void> {
  await vault.removeItem(`key:${providerId}`);
}

export async function clearAllKeys(): Promise<void> {
  const keys = await vault.keys();
  await Promise.all(keys.filter((key) => key.startsWith("key:")).map((key) => vault.removeItem(key)));
  // Rotate the device secret as well so old ciphertext cannot be recovered with a retained key.
  await vault.removeItem(DEVICE_SECRET_ID);
  derivedKeyPromise = null;
}

export type KeyStoreAvailability = "ready" | "unavailable";

export function keyStoreAvailability(): KeyStoreAvailability {
  if (typeof window === "undefined") return "unavailable";
  return window.crypto?.subtle ? "ready" : "unavailable";
}

/**
 * Honest security boundary:
 * keys are encrypted with AES-GCM under a PBKDF2-derived device key. The device
 * secret lives in the same IndexedDB origin. This protects against casual disk
 * inspection and raw database dumps, not against XSS, a compromised browser, or
 * an attacker who can execute same-origin code. It is not a hardware vault.
 */
export const KEY_VAULT_SECURITY_NOTE =
  "Keys are AES-GCM encrypted with a device-local PBKDF2 key in IndexedDB. This is at-rest obfuscation, not protection from XSS or a compromised device.";
