"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wifi,
  Zap,
} from "lucide-react";
import Link from "next/link";
import {
  capabilityLabel,
  directModeLabel,
  getProvider,
  PROVIDERS,
  type ProviderId,
} from "@/lib/providers";
import {
  clearAllKeys,
  deleteApiKey,
  getApiKey,
  saveApiKey,
  KEY_VAULT_SECURITY_NOTE,
} from "@/lib/keyStore";
import { clearAnalysisCache, getCacheStats } from "@/lib/cache";
import {
  DEFAULT_SETTINGS,
  directModeAllowed,
  loadSettings,
  modeLabel,
  saveSettings,
  settingsForProvider,
} from "@/lib/settingsStore";
import { testProviderConnection } from "@/lib/client";
import type { AppSettings } from "@/lib/types";
import { cn, formatUsd } from "@/lib/utils";

type Notice = { type: "ok" | "error" | "info"; message: string } | null;

export function SettingsForm() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStored, setKeyStored] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [testResult, setTestResult] = useState<{ latencyMs: number; message: string } | null>(null);
  const [cacheEntries, setCacheEntries] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const preset = getProvider(settings.providerId);
  const canDirect = directModeAllowed(settings);
  const supportsDirect = preset.directMode !== "unsupported";
  const requiresKey = preset.requiresKey;
  const usesKey = requiresKey || settings.providerId === "custom";

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setHydrated(true);
    void getApiKey(loaded.providerId).then((key) => setKeyStored(Boolean(key)));
    void getCacheStats().then((stats) => setCacheEntries(stats.entries));
  }, []);

  const modelOptions = useMemo(() => preset.models.map((model) => model.id), [preset]);

  function patch(patchValue: Partial<AppSettings>) {
    setSettings((current) => ({ ...current, ...patchValue }));
    setNotice(null);
    setTestResult(null);
  }

  async function changeProvider(providerId: ProviderId) {
    const next = settingsForProvider(providerId, settings);
    setSettings(next);
    setKeyInput("");
    setKeyStored(Boolean(await getApiKey(providerId)));
    setNotice(null);
    setTestResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      const base = settings.baseUrl.trim().replace(/\/+$/, "");
      if (!base) throw new Error("Base URL is required.");
      try {
        new URL(base);
      } catch {
        throw new Error("Base URL must be a valid URL, including https://.");
      }
      if (!settings.model.trim()) throw new Error("Model is required.");
      if (settings.budgetCeilingUsd < 0) throw new Error("Budget ceiling cannot be negative.");
      if (settings.mode === "direct" && !canDirect) {
        throw new Error("Direct Mode is not allowed for this provider. Switch to Stateless Proxy.");
      }

      if (keyInput.trim()) {
        if (!requiresKey && settings.providerId !== "custom") {
          throw new Error("This provider does not use an API key.");
        }
        await saveApiKey(settings.providerId, keyInput.trim());
        setKeyStored(true);
        setKeyInput("");
      } else if (requiresKey && !keyStored) {
        throw new Error("Enter an API key before saving.");
      }

      const next = { ...settings, baseUrl: base, model: settings.model.trim() };
      saveSettings(next);
      setSettings(next);
      setNotice({ type: "ok", message: "Settings saved in this browser." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not save settings." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setNotice(null);
    setTestResult(null);
    try {
      const key = keyInput.trim() || (await getApiKey(settings.providerId)) || undefined;
      if (requiresKey && !key) throw new Error("Enter or save an API key first.");
      if (settings.mode === "direct" && !canDirect) {
        throw new Error("Direct Mode is not enabled for this provider.");
      }
      if (!settings.baseUrl.trim() || !settings.model.trim()) {
        throw new Error("Base URL and model are required before testing.");
      }
      const result = await testProviderConnection(
        { ...settings, baseUrl: settings.baseUrl.trim().replace(/\/+$/, "") },
        key,
      );
      setTestResult({ latencyMs: result.latencyMs, message: result.message });
      setNotice({ type: "ok", message: "Connection test passed." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Connection test failed." });
    } finally {
      setTesting(false);
    }
  }

  async function handleClearKey() {
    await deleteApiKey(settings.providerId);
    setKeyStored(false);
    setKeyInput("");
    setNotice({ type: "info", message: `Stored key for ${preset.name} removed.` });
  }

  async function handleClearAllKeys() {
    await clearAllKeys();
    setKeyStored(false);
    setKeyInput("");
    setNotice({ type: "info", message: "All stored provider keys and the device secret were removed." });
  }

  async function handleClearCache() {
    await clearAnalysisCache();
    setCacheEntries(0);
    setNotice({ type: "info", message: "The 24-hour critic cache was cleared." });
  }

  if (!hydrated) {
    return (
      <div className="shell py-20">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton mt-6 h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="shell pb-10 pt-12 sm:pt-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-bone/40 transition-colors hover:text-bone"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
        Back
      </Link>

      <div className="mt-8 flex flex-col justify-between gap-6 border-b border-bone/10 pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1 className="display mt-4 text-[clamp(2.8rem,6vw,5rem)] text-bone">
            Your model.
            <br />
            <span className="editorial-italic font-normal text-bone/80">Your terms.</span>
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-bone/40">
          The analysis is provider-agnostic. Bring a key, pick a routing mode, and the critics adapt
          their JSON strategy to the capability you declare.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "mt-6 flex items-start gap-3 border px-4 py-3.5 text-xs leading-relaxed",
            notice.type === "ok" && "border-risk-green/25 bg-risk-green/[0.04] text-bone/70",
            notice.type === "error" && "border-risk-red/25 bg-risk-red/[0.04] text-bone/70",
            notice.type === "info" && "border-bone/15 bg-bone/[0.025] text-bone/60",
          )}
        >
          {notice.type === "ok" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-risk-green" strokeWidth={1.5} />
          ) : notice.type === "error" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-red" strokeWidth={1.5} />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-bone/40" strokeWidth={1.5} />
          )}
          <div>
            {notice.message}
            {testResult && (
              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.12em] text-bone/35">
                {testResult.latencyMs}ms · {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="space-y-8">
          <section className="panel p-5 sm:p-6" aria-labelledby="provider-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">01 / Provider</p>
                <h2 id="provider-heading" className="mt-2 text-xl font-light tracking-tight text-bone">
                  Reasoning engine
                </h2>
              </div>
              <a
                href={preset.docsUrl || "#"}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-[8px] uppercase tracking-[0.14em] text-bone/30 underline-offset-4 hover:text-bone/60 hover:underline"
              >
                Docs ↗
              </a>
            </div>

            <div className="mt-6">
              <label htmlFor="provider" className="field-label">
                Provider
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <select
                    id="provider"
                    value={settings.providerId}
                    onChange={(event) => void changeProvider(event.target.value as ProviderId)}
                    className="field appearance-none pr-10"
                  >
                    {PROVIDERS.map((provider) => (
                      <option key={provider.id} value={provider.id} className="bg-ink-900">
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone/35" strokeWidth={1.5} />
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 border px-3 py-3 font-mono text-[8px] uppercase tracking-[0.12em]",
                    preset.jsonMode === "supported" && "border-risk-green/25 text-risk-green/70",
                    preset.jsonMode === "unsupported" && "border-risk-red/25 text-risk-red/70",
                    preset.jsonMode === "model-dependent" && "border-risk-amber/25 text-risk-amber/70",
                  )}
                >
                  <BadgeCheck className="h-3 w-3" strokeWidth={1.5} />
                  {capabilityLabel(preset.jsonMode)}
                </span>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-bone/35">{preset.note}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="tag">{directModeLabel(preset.directMode)}</span>
                <span className="tag">
                  {preset.requiresKey
                    ? "API key required"
                    : settings.providerId === "custom"
                      ? "Optional API key"
                      : "No key required"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="base-url" className="field-label">
                  Base URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="base-url"
                    value={settings.baseUrl}
                    onChange={(event) => patch({ baseUrl: event.target.value })}
                    className="field font-mono text-[11px]"
                    placeholder="https://api.example.com/v1"
                    spellCheck={false}
                  />
                  {preset.baseUrl && settings.baseUrl !== preset.baseUrl && (
                    <button
                      type="button"
                      onClick={() => patch({ baseUrl: preset.baseUrl })}
                      className="shrink-0 border border-bone/10 px-3 text-bone/40 transition-colors hover:border-bone/25 hover:text-bone"
                      title="Restore preset URL"
                    >
                      <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="model" className="field-label">
                  Model
                </label>
                <input
                  id="model"
                  list="model-options"
                  value={settings.model}
                  onChange={(event) => patch({ model: event.target.value })}
                  className="field font-mono text-[11px]"
                  placeholder="model-id"
                  spellCheck={false}
                />
                <datalist id="model-options">
                  {modelOptions.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start justify-between gap-5 border border-bone/10 p-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone/60">
                  Send response_format: json_object
                </p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-bone/30">
                  {preset.jsonMode === "unsupported"
                    ? "This provider does not support JSON mode. Prompt-level JSON plus Zod validation is used."
                    : "Only enable if the selected model supports JSON mode. If it rejects the parameter, disable it."}
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.supportsJsonMode}
                disabled={preset.jsonMode === "unsupported"}
                onChange={(event) => patch({ supportsJsonMode: event.target.checked })}
                className="mt-1 h-4 w-4 shrink-0 accent-[#f4f1ea] disabled:opacity-30"
                aria-label="Enable JSON mode"
              />
            </label>
          </section>

          <section className="panel p-5 sm:p-6" aria-labelledby="mode-heading">
            <p className="eyebrow">02 / Routing</p>
            <h2 id="mode-heading" className="mt-2 text-xl font-light tracking-tight text-bone">
              Where the key travels
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Routing mode">
              <button
                type="button"
                role="radio"
                aria-checked={settings.mode === "proxy"}
                onClick={() => patch({ mode: "proxy" })}
                className={cn(
                  "border p-4 text-left transition-colors",
                  settings.mode === "proxy" ? "border-bone/40 bg-bone/[0.04]" : "border-bone/10 hover:border-bone/25",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone/80">
                    Mode A · {modeLabel("proxy")}
                  </span>
                  <span className={cn("h-3 w-3 rounded-full border", settings.mode === "proxy" ? "border-bone bg-bone" : "border-bone/25")} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-bone/40">
                  Decrypted in your browser, sent over HTTPS with each request, used for that request
                  only, never logged or persisted on the server.
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={settings.mode === "direct"}
                disabled={!supportsDirect}
                onClick={() => patch({ mode: "direct" })}
                className={cn(
                  "border p-4 text-left transition-colors",
                  settings.mode === "direct" ? "border-bone/40 bg-bone/[0.04]" : "border-bone/10 hover:border-bone/25",
                  !supportsDirect && "cursor-not-allowed opacity-40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone/80">
                    Mode B · {modeLabel("direct")}
                  </span>
                  <span className={cn("h-3 w-3 rounded-full border", settings.mode === "direct" ? "border-bone bg-bone" : "border-bone/25")} />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-bone/40">
                  The browser calls the provider directly. No proxy. Only for CORS-friendly, local, or
                  explicitly opted-in providers.
                </p>
              </button>
            </div>

            {settings.mode === "proxy" ? (
              <div className="mt-4 flex items-start gap-3 border border-risk-amber/20 bg-risk-amber/[0.035] p-4">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-risk-amber/80" strokeWidth={1.5} />
                <p className="text-[11px] leading-relaxed text-bone/45">
                  Your key is sent to our stateless proxy for each request. We do not log or store it.
                  If your threat model requires the key to never leave your device, use Direct Mode.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-3 border border-risk-amber/30 bg-risk-amber/[0.045] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-amber" strokeWidth={1.5} />
                <p className="text-[11px] leading-relaxed text-bone/50">
                  Direct Mode exposes your key to this browser&apos;s network tab and to any script
                  running on this origin. Use it for local models or providers you trust. CORS can
                  still block the call.
                </p>
              </div>
            )}

            {(preset.directMode === "opt-in" || settings.providerId === "anthropic") && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 border border-bone/10 p-4">
                <input
                  type="checkbox"
                  checked={settings.allowAnthropicDirect}
                  onChange={(event) => patch({ allowAnthropicDirect: event.target.checked, mode: event.target.checked ? "direct" : "proxy" })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#f4f1ea]"
                />
                <span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone/60">
                    Advanced opt-in: enable Direct Mode
                  </span>
                  <span className="mt-1.5 block text-[10px] leading-relaxed text-bone/35">
                    Anthropic requires the dangerous direct-browser header, and the key remains
                    visible in DevTools. Off by default. Only enable if you accept that tradeoff.
                  </span>
                </span>
              </label>
            )}
          </section>

          <section className="panel p-5 sm:p-6" aria-labelledby="key-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">03 / Credential</p>
                <h2 id="key-heading" className="mt-2 text-xl font-light tracking-tight text-bone">
                  {usesKey ? "API key" : "Keyless provider"}
                </h2>
              </div>
              <span className={cn("tag", keyStored ? "border-risk-green/25 text-risk-green/70" : "text-bone/35")}>
                <KeyRound className="h-2.5 w-2.5" strokeWidth={1.5} />
                {keyStored ? "key stored" : usesKey ? "no key" : "not required"}
              </span>
            </div>

            {usesKey ? (
              <>
                <div className="mt-5">
                  <label htmlFor="api-key" className="field-label">
                    {keyStored ? "Replace stored key" : "Paste key"}
                  </label>
                  <div className="relative">
                    <input
                      id="api-key"
                      type={showKey ? "text" : "password"}
                      value={keyInput}
                      onChange={(event) => setKeyInput(event.target.value)}
                      placeholder={keyStored ? "••••••••••••••••••••  (stored)" : "sk-…"}
                      autoComplete="off"
                      spellCheck={false}
                      className="field pr-12 font-mono text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bone/30 transition-colors hover:text-bone/70"
                      aria-label={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-bone/30">
                    AES-GCM encrypted at rest in IndexedDB. Click Save settings to persist. The
                    plaintext key is only held for the request or the connection test.
                    {settings.providerId === "custom" && !requiresKey
                      ? " Optional for keyless endpoints such as LM Studio."
                      : ""}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTest()}
                    disabled={testing}
                    className="btn-ghost"
                  >
                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Wifi className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    {testing ? "Testing" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClearKey()}
                    disabled={!keyStored}
                    className="btn-ghost disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Clear key
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5">
                <div className="flex items-start gap-3 border border-bone/10 p-4">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-bone/35" strokeWidth={1.5} />
                  <p className="text-[11px] leading-relaxed text-bone/40">
                    {preset.name} does not require a key. JSON capability depends on the local model.
                    Use Direct Mode so the request goes from this browser to your machine.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleTest()}
                  disabled={testing}
                  className="btn-ghost mt-4"
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Wifi className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  {testing ? "Testing" : "Test connection"}
                </button>
              </div>
            )}
          </section>

          <section className="panel p-5 sm:p-6" aria-labelledby="budget-heading">
            <p className="eyebrow">04 / Guardrails</p>
            <h2 id="budget-heading" className="mt-2 text-xl font-light tracking-tight text-bone">
              Budget & cache
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="budget" className="field-label">
                  Analysis ceiling (USD)
                </label>
                <input
                  id="budget"
                  type="number"
                  min={0}
                  step={0.01}
                  value={settings.budgetCeilingUsd}
                  onChange={(event) => patch({ budgetCeilingUsd: Number(event.target.value) })}
                  className="field font-mono text-[12px]"
                />
                <p className="mt-2 text-[10px] leading-relaxed text-bone/30">
                  The app estimates four critic calls plus one summary call. Above this ceiling — or
                  on a premium model — it asks before spending. Current ceiling:{" "}
                  {formatUsd(settings.budgetCeilingUsd)}.
                </p>
              </div>
              <div>
                <p className="field-label">Critic cache</p>
                <p className="text-3xl font-light tracking-tight text-bone/80">
                  {cacheEntries === null ? "—" : cacheEntries}
                </p>
                <p className="mt-1 text-[10px] text-bone/30">
                  entries · 24h TTL · IndexedDB
                </p>
                <button
                  type="button"
                  onClick={() => void handleClearCache()}
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-bone/35 underline-offset-4 hover:text-bone hover:underline"
                >
                  <Trash2 className="h-2.5 w-2.5" strokeWidth={1.5} />
                  Clear cache
                </button>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void handleClearAllKeys()}
              className="font-mono text-[8px] uppercase tracking-[0.14em] text-bone/25 underline-offset-4 transition-colors hover:text-risk-red/70 hover:underline"
            >
              Remove all keys & rotate device secret
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="btn-primary min-w-44">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Check className="h-3.5 w-3.5" strokeWidth={2} />}
              {saving ? "Saving" : "Save settings"}
            </button>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28">
          <div className="panel p-5">
            <p className="eyebrow">Security posture</p>
            <div className="mt-4 flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-risk-green/70" strokeWidth={1.5} />
              <p className="text-[11px] leading-relaxed text-bone/45">{KEY_VAULT_SECURITY_NOTE}</p>
            </div>
            <div className="mt-4 border-t border-bone/10 pt-4">
              <p className="text-[10px] leading-relaxed text-bone/30">
                The vault is bound to this browser origin. Clearing site data or rotating the device
                secret makes existing ciphertext unrecoverable by design.
              </p>
            </div>
          </div>

          <div className="panel p-5">
            <p className="eyebrow">Recommended defaults</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-risk-green/70" />
                <div>
                  <p className="text-sm text-bone/70">GLM 5.3 Flash</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-bone/30">
                    1,048,576-token context. Use OpenRouter <code className="text-bone/45">z-ai/glm-5.3-flash</code> or Zhipu <code className="text-bone/45">glm-5.3-flash</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-bone/40" />
                <div>
                  <p className="text-sm text-bone/70">DeepSeek Chat</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-bone/30">
                    Fully supported alternative with JSON mode and low cost. Set provider to DeepSeek
                    and model to <code className="text-bone/45">deepseek-chat</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-bone/10 p-5">
            <p className="eyebrow">Private by construction</p>
            <ul className="mt-4 space-y-3">
              {[
                "No server-side key storage.",
                "No request-body logging.",
                "No silent provider fallback.",
                "No LLM-computed risk score.",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[10px] text-bone/40">
                  <Check className="h-3 w-3 text-bone/30" strokeWidth={2} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-bone/10 pt-4 font-mono text-[8px] uppercase tracking-[0.14em] text-bone/20">
            <span>Mode</span>
            <span>{modeLabel(settings.mode)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
