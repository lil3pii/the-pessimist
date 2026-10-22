import { z, ZodError, type ZodType } from "zod";
import { chatCompletionsUrl, getProvider, type ProviderId } from "@/lib/providers";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  providerId: ProviderId;
  baseUrl: string;
  model: string;
  apiKey?: string;
  supportsJsonMode: boolean;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Connectivity pings may legitimately return zero tokens. */
  allowEmpty?: boolean;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  latencyMs: number;
  attempts: number;
  providerId: ProviderId;
  model: string;
  jsonMode: boolean;
  finishReason?: string;
}

export type LLMErrorStage = "configuration" | "transport" | "timeout" | "http";

export class LLMError extends Error {
  readonly stage: LLMErrorStage;
  readonly status?: number;
  readonly retryable: boolean;
  readonly attempts: number;

  constructor(
    message: string,
    options: { stage: LLMErrorStage; status?: number; retryable?: boolean; attempts?: number },
  ) {
    super(message);
    this.name = "LLMError";
    this.stage = options.stage;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.attempts = options.attempts ?? 1;
  }
}

export type StructuredOutputStage = "parse" | "schema";

export class StructuredOutputError extends Error {
  readonly stage: StructuredOutputStage;
  readonly raw: string;
  readonly zodError: ZodError;
  readonly attempts: number;

  constructor(stage: StructuredOutputStage, raw: string, zodError: ZodError, attempts: number) {
    super(stage === "parse" ? "The model did not return parseable JSON." : "The model returned JSON that failed schema validation.");
    this.name = "StructuredOutputError";
    this.stage = stage;
    this.raw = raw;
    this.zodError = zodError;
    this.attempts = attempts;
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;
const TRANSPORT_RETRIES = 2;
const BASE_BACKOFF_MS = 600;

export function parseJsonContent(raw: string): unknown {
  const stripped = raw
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error("Response contained no JSON object.");
  }
}

export function assertBaseUrl(baseUrl: string, options: { allowLocal: boolean }): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new LLMError("Base URL is not a valid URL.", { stage: "configuration" });
  }

  if (parsed.username || parsed.password) {
    throw new LLMError("Base URL must not contain embedded credentials.", { stage: "configuration" });
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (isLocal) {
    if (!options.allowLocal) {
      throw new LLMError("Local provider URLs are only allowed in Direct Mode from your browser.", {
        stage: "configuration",
      });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new LLMError("Local provider URL must use HTTP or HTTPS.", { stage: "configuration" });
    }
    return parsed;
  }

  if (parsed.protocol !== "https:") {
    throw new LLMError("Remote provider URLs must use HTTPS.", { stage: "configuration" });
  }
  return parsed;
}

function providerHeaders(options: LLMCallOptions): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = options.apiKey?.trim();
  const provider = getProvider(options.providerId);

  if (!key && provider.requiresKey) {
    throw new LLMError(`An API key is required for ${provider.name}.`, { stage: "configuration" });
  }

  if (key) {
    if (provider.authStyle === "anthropic") {
      headers.Authorization = `Bearer ${key}`;
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      if (typeof window !== "undefined") {
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      }
    } else {
      headers.Authorization = `Bearer ${key}`;
    }
  }

  if (provider.id === "openrouter") {
    headers["X-Title"] = "The Pessimist";
  }

  // A URL supplied by a browser must not turn the proxy into an arbitrary
  // internal-network client. Self-hosters can explicitly opt in for local
  // provider testing; Vercel deployments should leave this false.
  const localAllowed =
    typeof window !== "undefined" ||
    (typeof process !== "undefined" && process.env.ALLOW_LOCAL_PROVIDER_PROXY === "true");
  assertBaseUrl(options.baseUrl, { allowLocal: localAllowed });
  return headers;
}

function redact(message: string, apiKey?: string): string {
  if (!apiKey) return message;
  return message.split(apiKey).join("[redacted]");
}

function readUsage(value: unknown): LLMUsage {
  if (!value || typeof value !== "object") return {};
  const usage = value as Record<string, unknown>;
  return {
    promptTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
    completionTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined,
    totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
  };
}

function readContent(payload: unknown, allowEmpty = false): { content: string; finishReason?: string } {
  if (!payload || typeof payload !== "object") throw new Error("Empty response body.");
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("Response contained no choices.");
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown; finish_reason?: unknown };
  const rawContent = first.message?.content ?? first.text;
  let content = "";
  if (typeof rawContent === "string") {
    content = rawContent;
  } else if (Array.isArray(rawContent)) {
    content = rawContent
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : ""))
      .join("");
  }
  if (!allowEmpty && !content.trim()) throw new Error("Response content was empty.");
  return {
    content,
    finishReason: typeof first.finish_reason === "string" ? first.finish_reason : undefined,
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error("Aborted"));
      },
      { once: true },
    );
  });
}

function retryDelay(attempt: number, retryAfterHeader?: string | null): number {
  const retryAfter = Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt + jitter, 8_000);
}

export async function callProvider(options: LLMCallOptions): Promise<LLMResponse> {
  const baseUrl = options.baseUrl.trim();
  const headers = providerHeaders(options);
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1200,
    stream: false,
  };
  if (options.supportsJsonMode) body.response_format = { type: "json_object" };

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= TRANSPORT_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new DOMException("LLM call timed out.", "TimeoutError"));
    }, timeoutMs);

    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const response = await fetchImpl(chatCompletionsUrl(baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = redact((await response.text()).slice(0, 1200), options.apiKey);
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < TRANSPORT_RETRIES) {
          const delay = retryDelay(attempt, response.headers.get("retry-after"));
          console.info(
            `[llm] provider=${options.providerId} model=${options.model} json_mode=${options.supportsJsonMode} status=${response.status} retry=${attempt + 1} wait_ms=${delay}`,
          );
          await sleep(delay, options.signal);
          continue;
        }
        throw new LLMError(
          `Provider returned HTTP ${response.status}: ${errorText || response.statusText}`,
          {
            stage: "http",
            status: response.status,
            retryable,
            attempts: attempt + 1,
          },
        );
      }

      const payload: unknown = await response.json();
      const parsed = readContent(payload, options.allowEmpty);
      const usage = readUsage((payload as { usage?: unknown }).usage);
      const latencyMs = Date.now() - startedAt;

      console.info(
        `[llm] provider=${options.providerId} model=${options.model} json_mode=${options.supportsJsonMode} format=${options.supportsJsonMode ? "json_object" : "prompt_only"} attempts=${attempt + 1} latency_ms=${latencyMs}`,
      );

      return {
        content: parsed.content,
        usage,
        latencyMs,
        attempts: attempt + 1,
        providerId: options.providerId,
        model: options.model,
        jsonMode: options.supportsJsonMode,
        finishReason: parsed.finishReason,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof LLMError) throw error;

      const isTimeout = controller.signal.reason instanceof DOMException && controller.signal.reason.name === "TimeoutError";
      const isExternalAbort = options.signal?.aborted ?? false;
      const isTransport = !isTimeout && !isExternalAbort;

      if (isTransport && attempt < TRANSPORT_RETRIES) {
        const delay = retryDelay(attempt);
        console.info(
          `[llm] provider=${options.providerId} model=${options.model} transport_retry=${attempt + 1} wait_ms=${delay}`,
        );
        await sleep(delay, options.signal);
        continue;
      }

      if (isTimeout) {
        throw new LLMError(
          `The provider did not respond within ${Math.round(timeoutMs / 1000)}s.`,
          { stage: "timeout", retryable: true, attempts: attempt + 1 },
        );
      }
      throw new LLMError(redact(lastError.message, options.apiKey), {
        stage: "transport",
        retryable: false,
        attempts: attempt + 1,
      });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  throw new LLMError(lastError?.message ?? "LLM call failed.", {
    stage: "transport",
    retryable: false,
    attempts: TRANSPORT_RETRIES + 1,
  });
}

export type ProviderCaller = (options: LLMCallOptions) => Promise<LLMResponse>;

export interface JSONCompletionOptions<T> extends LLMCallOptions {
  schema: ZodType<T>;
  correctivePrompt: (error: ZodError, raw: string) => string;
}

export interface JSONCompletionResult<T> {
  data: T;
  raw: string;
  response: LLMResponse;
  correctiveRetryUsed: boolean;
}

function asZodError(error: unknown, prefix: string): ZodError {
  if (error instanceof ZodError) return error;
  return new ZodError([
    {
      code: z.ZodIssueCode.custom,
      path: [],
      message: `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
    },
  ]);
}

/**
 * Calls the provider, parses JSON, validates with Zod, and performs exactly one
 * corrective retry on parse or schema failure. Transport retries are separate
 * and happen inside callProvider. Never falls back to another model.
 */
export async function completeJSON<T>(
  options: JSONCompletionOptions<T>,
  call: ProviderCaller = callProvider,
): Promise<JSONCompletionResult<T>> {
  const first = await call(options);
  let parsedOutput = "";
  let validationError: ZodError;

  try {
    const parsed = parseJsonContent(first.content);
    const validated = options.schema.safeParse(parsed);
    if (validated.success) {
      return { data: validated.data, raw: first.content, response: first, correctiveRetryUsed: false };
    }
    validationError = validated.error;
    parsedOutput = first.content;
  } catch (error) {
    validationError = asZodError(error, "Invalid JSON");
    parsedOutput = first.content;
  }

  const stage: StructuredOutputStage = validationError.issues.every((issue) => issue.code === z.ZodIssueCode.custom)
    ? "parse"
    : "schema";

  console.info(
    `[llm] structured_output_retry provider=${options.providerId} model=${options.model} stage=${stage} json_mode=${options.supportsJsonMode}`,
  );

  const correctiveMessages: LLMMessage[] = [
    ...options.messages,
    { role: "assistant", content: first.content.slice(0, 12_000) },
    { role: "system", content: options.correctivePrompt(validationError, parsedOutput) },
  ];

  const second = await call({ ...options, messages: correctiveMessages });
  try {
    const parsed = parseJsonContent(second.content);
    const validated = options.schema.safeParse(parsed);
    if (!validated.success) {
      throw new StructuredOutputError("schema", second.content, validated.error, first.attempts + second.attempts);
    }
    return {
      data: validated.data,
      raw: second.content,
      response: {
        ...second,
        attempts: first.attempts + second.attempts,
        latencyMs: first.latencyMs + second.latencyMs,
      },
      correctiveRetryUsed: true,
    };
  } catch (error) {
    if (error instanceof StructuredOutputError) throw error;
    throw new StructuredOutputError(
      "parse",
      second.content,
      asZodError(error, "Invalid JSON after corrective retry"),
      first.attempts + second.attempts,
    );
  }
}

export interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onDone?: (full: string) => void;
}

export type StreamCaller = (options: LLMCallOptions, callbacks: StreamCallbacks) => Promise<LLMResponse>;

/**
 * Streams structured JSON while still enforcing the schema. Tokens are exposed
 * to the UI as they arrive; if the completed object fails validation, exactly
 * one non-streaming corrective call is made. If that also fails, the typed
 * error is surfaced. No partial object is ever treated as valid.
 */
export async function completeJSONStream<T>(
  options: JSONCompletionOptions<T>,
  stream: StreamCaller,
  call: ProviderCaller,
  callbacks: StreamCallbacks,
): Promise<JSONCompletionResult<T>> {
  const first = await stream(options, callbacks);
  let parsedOutput = "";
  let validationError: ZodError;

  try {
    const parsed = parseJsonContent(first.content);
    const validated = options.schema.safeParse(parsed);
    if (validated.success) {
      return { data: validated.data, raw: first.content, response: first, correctiveRetryUsed: false };
    }
    validationError = validated.error;
    parsedOutput = first.content;
  } catch (error) {
    validationError = asZodError(error, "Invalid JSON");
    parsedOutput = first.content;
  }

  console.info(
    `[llm] streamed_json_retry provider=${options.providerId} model=${options.model} json_mode=${options.supportsJsonMode}`,
  );

  const correctiveMessages: LLMMessage[] = [
    ...options.messages,
    { role: "assistant", content: first.content.slice(0, 12_000) },
    { role: "system", content: options.correctivePrompt(validationError, parsedOutput) },
  ];
  const second = await call({ ...options, messages: correctiveMessages });

  try {
    const parsed = parseJsonContent(second.content);
    const validated = options.schema.safeParse(parsed);
    if (!validated.success) {
      throw new StructuredOutputError("schema", second.content, validated.error, first.attempts + second.attempts);
    }
    return {
      data: validated.data,
      raw: second.content,
      response: {
        ...second,
        attempts: first.attempts + second.attempts,
        latencyMs: first.latencyMs + second.latencyMs,
      },
      correctiveRetryUsed: true,
    };
  } catch (error) {
    if (error instanceof StructuredOutputError) throw error;
    throw new StructuredOutputError(
      "parse",
      second.content,
      asZodError(error, "Invalid JSON after corrective retry"),
      first.attempts + second.attempts,
    );
  }
}

/**
 * Streaming is intentionally single-attempt: once tokens have been shown, a
 * silent retry would duplicate output. Transport errors before the first token
 * are surfaced as LLMError.
 */
export async function streamProvider(options: LLMCallOptions, callbacks: StreamCallbacks): Promise<LLMResponse> {
  const providerHeadersValue = providerHeaders(options);
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2400,
    stream: true,
  };
  if (options.supportsJsonMode) body.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 60_000;
  const timer = setTimeout(() => controller.abort(new DOMException("Stream timed out.", "TimeoutError")), timeoutMs);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const startedAt = Date.now();

  try {
    const response = await (options.fetchImpl ?? fetch)(chatCompletionsUrl(options.baseUrl), {
      method: "POST",
      headers: providerHeadersValue,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = redact((await response.text()).slice(0, 1200), options.apiKey);
      throw new LLMError(`Provider returned HTTP ${response.status}: ${errorText || response.statusText}`, {
        stage: "http",
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    if (!response.body) throw new LLMError("Streaming response had no body.", { stage: "transport" });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let done = false;

    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          done = true;
          break;
        }
        try {
          const payload = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            usage?: unknown;
          };
          const delta = payload.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            callbacks.onDelta(delta);
          }
        } catch {
          // Ignore keep-alive comments and malformed partial frames.
        }
      }
    }

    if (!full.trim()) throw new LLMError("Stream ended without content.", { stage: "transport" });
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
  } catch (error) {
    if (error instanceof LLMError) throw error;
    const timeout = controller.signal.reason instanceof DOMException && controller.signal.reason.name === "TimeoutError";
    throw new LLMError(
      timeout ? "The provider stream timed out." : redact(error instanceof Error ? error.message : String(error), options.apiKey),
      { stage: timeout ? "timeout" : "transport", retryable: true },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
