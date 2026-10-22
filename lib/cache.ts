"use client";

import localforage from "localforage";
import { criticCacheKey, sha256Hex } from "@/lib/hash";
import type { CriticCacheValue, CacheEntry } from "@/lib/types";

const TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_VERSION = 1;

const cacheStore = localforage.createInstance({
  name: "the-pessimist",
  storeName: "analysis-cache",
  description: "24h critic result cache. Contains content-derived hashes, not API keys.",
});

const memoryCache = new Map<string, CacheEntry<CriticCacheValue>>();

export { criticCacheKey, sha256Hex };

export async function getCachedCritic(key: string): Promise<CriticCacheValue | null> {
  const now = Date.now();
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && memoryEntry.expiresAt > now) return memoryEntry.value;

  try {
    const stored = await cacheStore.getItem<CacheEntry<CriticCacheValue>>(`critic:${key}`);
    if (!stored || stored.version !== CACHE_VERSION || stored.expiresAt <= now) {
      if (stored) await cacheStore.removeItem(`critic:${key}`);
      return null;
    }
    memoryCache.set(key, stored);
    return stored.value;
  } catch {
    return null;
  }
}

export async function setCachedCritic(key: string, value: CriticCacheValue): Promise<void> {
  const now = Date.now();
  const entry: CacheEntry<CriticCacheValue> = {
    version: CACHE_VERSION,
    createdAt: now,
    expiresAt: now + TTL_MS,
    value,
  };
  memoryCache.set(key, entry);
  try {
    await cacheStore.setItem(`critic:${key}`, entry);
  } catch {
    // IndexedDB can be unavailable in private mode; the analysis still works.
  }
}

export async function clearAnalysisCache(): Promise<void> {
  memoryCache.clear();
  try {
    await cacheStore.clear();
  } catch {
    // Non-fatal.
  }
}

export async function getCacheStats(): Promise<{ entries: number }> {
  try {
    const keys = await cacheStore.keys();
    return { entries: keys.length };
  } catch {
    return { entries: 0 };
  }
}

export { TTL_MS as CACHE_TTL_MS };
