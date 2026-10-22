"use client";

import { getProvider, type ProviderId } from "@/lib/providers";
import type { AppSettings } from "@/lib/types";

export const SETTINGS_STORAGE_KEY = "the-pessimist/settings/v1";

export const DEFAULT_SETTINGS: AppSettings = {
  providerId: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "z-ai/glm-5.3-flash",
  supportsJsonMode: true,
  mode: "proxy",
  allowAnthropicDirect: false,
  budgetCeilingUsd: 0.25,
};

const PROVIDER_IDS = new Set<ProviderId>([
  "openai",
  "anthropic",
  "deepseek",
  "openrouter",
  "groq",
  "zhipu",
  "github",
  "ollama",
  "custom",
]);

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppSettings>;
  return (
    typeof candidate.providerId === "string" &&
    PROVIDER_IDS.has(candidate.providerId as ProviderId) &&
    typeof candidate.baseUrl === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.supportsJsonMode === "boolean" &&
    (candidate.mode === "proxy" || candidate.mode === "direct") &&
    typeof candidate.allowAnthropicDirect === "boolean" &&
    typeof candidate.budgetCeilingUsd === "number" &&
    Number.isFinite(candidate.budgetCeilingUsd)
  );
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!isAppSettings(parsed)) return DEFAULT_SETTINGS;
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function settingsForProvider(providerId: ProviderId, previous?: AppSettings): AppSettings {
  const preset = getProvider(providerId);
  const keepDirect =
    preset.directMode === "supported" ||
    (previous?.mode === "direct" && directModeAllowed({ ...(previous ?? DEFAULT_SETTINGS), providerId }));
  return {
    ...(previous ?? DEFAULT_SETTINGS),
    providerId,
    baseUrl: preset.baseUrl,
    model: preset.defaultModel,
    supportsJsonMode: preset.supportsJsonMode,
    mode: keepDirect ? "direct" : "proxy",
  };
}

export function directModeAllowed(settings: AppSettings): boolean {
  const preset = getProvider(settings.providerId);
  if (preset.directMode === "supported") return true;
  if (settings.providerId === "anthropic") return settings.allowAnthropicDirect;
  if (settings.providerId === "custom") return settings.allowAnthropicDirect;
  return false;
}

export function modeLabel(mode: AppSettings["mode"]): string {
  return mode === "proxy" ? "Stateless proxy" : "Direct mode";
}
