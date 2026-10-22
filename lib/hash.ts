import type { CriticId, PersonaId } from "@/lib/types";

const PROMPT_VERSION = "2026-10-critic-v1";

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("SHA-256 requires Web Crypto (available in modern browsers and Node 20+).");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export interface CriticCacheKeyInput {
  content: string;
  personaId: PersonaId;
  critic: CriticId;
  providerId: string;
  model: string;
}

export async function criticCacheKey(input: CriticCacheKeyInput): Promise<string> {
  const payload = [
    PROMPT_VERSION,
    input.critic,
    input.providerId,
    input.model,
    input.personaId,
    input.content,
  ].join("\u0000");
  return sha256Hex(payload);
}
