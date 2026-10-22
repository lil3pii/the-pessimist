"use client";

import {
  callProvider,
  LLMError,
  streamProvider,
  type LLMCallOptions,
  type LLMResponse,
  type ProviderCaller,
  type StreamCallbacks,
  type StreamCaller,
} from "@/lib/llm";
import { getProvider } from "@/lib/providers";
import type { AppSettings } from "@/lib/types";

function apiPayload(options: LLMCallOptions) {
  return {
    providerId: options.providerId,
    baseUrl: options.baseUrl,
    model: options.model,
    apiKey: options.apiKey,
    supportsJsonMode: options.supportsJsonMode,
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };
}

export async function callViaProxy(options: LLMCallOptions): Promise<LLMResponse> {
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", request: apiPayload(options) }),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new LLMError(
      error instanceof Error && error.name === "AbortError"
        ? "The request was cancelled."
        : "Could not reach the stateless proxy.",
      { stage: "transport", retryable: true },
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Keep the status-based error below.
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Proxy returned HTTP ${response.status}.`;
    throw new LLMError(message, {
      stage: response.status === 401 ? "configuration" : "http",
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      attempts: 1,
    });
  }

  const data = payload as Partial<LLMResponse>;
  if (!data || typeof data.content !== "string") {
    throw new LLMError("The proxy returned an unexpected response shape.", { stage: "transport" });
  }

  return {
    content: data.content,
    usage: data.usage ?? {},
    latencyMs: data.latencyMs ?? 0,
    attempts: data.attempts ?? 1,
    providerId: options.providerId,
    model: options.model,
    jsonMode: options.supportsJsonMode,
    finishReason: data.finishReason,
  };
}

export function createProviderCaller(settings: AppSettings): ProviderCaller {
  if (settings.mode === "direct") return callProvider;
  return callViaProxy;
}

export async function streamViaProxy(options: LLMCallOptions, callbacks: StreamCallbacks): Promise<LLMResponse> {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", request: { ...apiPayload(options), stream: true } }),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new LLMError(
      error instanceof Error && error.name === "AbortError"
        ? "The stream was cancelled."
        : "Could not reach the stateless streaming proxy.",
      { stage: "transport", retryable: true },
    );
  }

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new LLMError(payload.error ?? `Proxy returned HTTP ${response.status}.`, {
      stage: response.status === 401 ? "configuration" : "http",
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let streamError: string | null = null;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      let eventName = "message";
      let data = "";
      for (const line of event.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as { delta?: string; content?: string; error?: string };
        if (eventName === "delta" && parsed.delta) {
          full += parsed.delta;
          callbacks.onDelta(parsed.delta);
        } else if (eventName === "done") {
          full = parsed.content ?? full;
        } else if (eventName === "error") {
          streamError = parsed.error ?? "The streaming provider failed.";
        }
      } catch {
        // Ignore keep-alive frames and malformed partial events.
      }
    }
  }

  if (streamError) throw new LLMError(streamError, { stage: "http", retryable: true });
  if (!full.trim()) throw new LLMError("The stream ended without content.", { stage: "transport" });
  callbacks.onDone?.(full);

  return {
    content: full,
    usage: {},
    latencyMs: Date.now() - startedAt,
    attempts: 1,
    providerId: options.providerId,
    model: options.model,
    jsonMode: options.supportsJsonMode,
  };
}

export function createStreamProvider(settings: AppSettings): StreamCaller {
  if (settings.mode === "direct") return streamProvider;
  return streamViaProxy;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
  provider: string;
  model: string;
}

export async function testProviderConnection(
  settings: AppSettings,
  apiKey: string | undefined,
): Promise<ConnectionTestResult> {
  const preset = getProvider(settings.providerId);
  const startedAt = Date.now();

  if (settings.mode === "proxy") {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ping",
        config: {
          providerId: settings.providerId,
          baseUrl: settings.baseUrl,
          model: settings.model,
          apiKey,
          supportsJsonMode: settings.supportsJsonMode,
        },
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; latencyMs?: number };
    if (!response.ok) {
      throw new Error(payload.error ?? `Proxy test failed with HTTP ${response.status}.`);
    }
    return {
      ok: true,
      latencyMs: payload.latencyMs ?? Date.now() - startedAt,
      message: `Reached ${preset.name} through the stateless proxy.`,
      provider: preset.name,
      model: settings.model,
    };
  }

  const response = await callProvider({
    providerId: settings.providerId,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey,
    supportsJsonMode: false,
    messages: [{ role: "user", content: "Reply with the single word: ok" }],
    maxTokens: 1,
    temperature: 0,
    allowEmpty: true,
    timeoutMs: 20_000,
  });
  return {
    ok: true,
    latencyMs: response.latencyMs,
    message: `Reached ${preset.name} directly from this browser.`,
    provider: preset.name,
    model: settings.model,
  };
}
