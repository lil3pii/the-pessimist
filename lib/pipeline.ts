import { computeRisk } from "@/lib/aggregator";
import { detectFixConflicts } from "@/lib/conflicts";
import { generateCritic, toCriticError } from "@/lib/criticEngine";
import { criticCacheKey, sha256Hex } from "@/lib/hash";
import { LLMError, completeJSON, completeJSONStream, type ProviderCaller, type StreamCaller } from "@/lib/llm";
import { getProvider } from "@/lib/providers";
import {
  rewriteSystemPrompt,
  rewriteUserPrompt,
  summarySystemPrompt,
  summaryUserPrompt,
} from "@/lib/prompts";
import {
  minimalRewriteExample,
  minimalSummaryExample,
  rewriteSchema,
  summarySchema,
} from "@/lib/schemas";
import type {
  AnalysisInput,
  AnalysisReport,
  AppSettings,
  CriticCacheValue,
  CriticId,
  CriticRun,
  CriticRunMap,
  FixOption,
  RewriteChange,
  SummaryRun,
} from "@/lib/types";
import { CRITIC_IDS, PERSONAS } from "@/lib/types";

const PIPELINE_DEADLINE_MS = 120_000;
const CRITIC_TIMEOUT_MS = 30_000;

export interface CriticCacheAdapter {
  get: (key: string) => Promise<CriticCacheValue | null>;
  set: (key: string, value: CriticCacheValue) => Promise<void>;
}

export interface RunAnalysisOptions {
  input: AnalysisInput;
  settings: AppSettings;
  apiKey?: string;
  call: ProviderCaller;
  cache?: CriticCacheAdapter;
  signal?: AbortSignal;
  stream?: StreamCaller;
  onSummaryDelta?: (delta: string) => void;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `report-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function runOneCritic(
  critic: CriticId,
  options: RunAnalysisOptions,
  signal: AbortSignal,
): Promise<CriticRun> {
  const { input, settings, apiKey, call, cache } = options;
  const startedAt = Date.now();
  let cacheKey: string | null = null;

  try {
    cacheKey = await criticCacheKey({
      content: input.content,
      personaId: input.personaId,
      critic,
      providerId: settings.providerId,
      model: settings.model,
    });
    const cached = await cache?.get(cacheKey);
    if (cached) {
      return {
        status: "success",
        critic,
        result: cached.result,
        probability: cached.probability,
        grounding: cached.grounding,
        cached: true,
        provider: settings.providerId,
        model: settings.model,
        jsonMode: cached.jsonMode,
        latencyMs: 0,
        attempts: cached.attempts,
      };
    }

    const generated = await generateCritic(
      critic,
      input.content,
      input.personaId,
      {
        providerId: settings.providerId,
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey,
        supportsJsonMode: settings.supportsJsonMode,
        timeoutMs: CRITIC_TIMEOUT_MS,
        signal,
      },
      call,
    );

    const value: CriticCacheValue = {
      result: generated.result,
      probability: generated.probability,
      grounding: generated.grounding,
      latencyMs: generated.latencyMs,
      attempts: generated.attempts,
      jsonMode: generated.jsonMode,
    };
    if (cacheKey) void cache?.set(cacheKey, value).catch(() => undefined);

    return {
      status: "success",
      critic,
      result: generated.result,
      probability: generated.probability,
      grounding: generated.grounding,
      cached: false,
      provider: settings.providerId,
      model: settings.model,
      jsonMode: generated.jsonMode,
      latencyMs: generated.latencyMs,
      attempts: generated.attempts,
    };
  } catch (error) {
    const timedOut = signal.aborted;
    const normalized =
      timedOut && !(error instanceof LLMError && error.stage === "timeout")
        ? new LLMError("The 120-second analysis deadline was reached while this critic was running.", {
            stage: "timeout",
            retryable: true,
            attempts: 1,
          })
        : error;

    // Re-use the single error normalizer used by the retryable critic card.
    return {
      status: "failure",
      critic,
      error: toCriticError(normalized),
      cached: false,
      provider: settings.providerId,
      model: settings.model,
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function runSummary(
  options: RunAnalysisOptions,
  runs: CriticRunMap,
  signal: AbortSignal,
): Promise<SummaryRun> {
  const startedAt = Date.now();
  const successes = Object.values(runs).filter((run) => run?.status === "success");
  if (successes.length === 0) {
    return {
      status: "failure",
      error: "No critic produced a valid result, so the executive readout was skipped.",
      latencyMs: 0,
    };
  }

  try {
    const summaryOptions = {
      providerId: options.settings.providerId,
      baseUrl: options.settings.baseUrl,
      model: options.settings.model,
      apiKey: options.apiKey,
      supportsJsonMode: options.settings.supportsJsonMode,
      messages: [
        { role: "system" as const, content: summarySystemPrompt() },
        { role: "user" as const, content: summaryUserPrompt(options.input.content, options.input.personaId, runs) },
      ],
      temperature: 0.35,
      maxTokens: 900,
      timeoutMs: CRITIC_TIMEOUT_MS,
      signal,
      schema: summarySchema,
      correctivePrompt: (error: { issues: Array<{ message: string }> }, raw: string) =>
        `Your previous summary failed validation: ${error.issues.map((issue) => issue.message).join("; ")}.\nPrevious response:\n${raw.slice(0, 1000)}\nRequired shape:\n${minimalSummaryExample()}\nReturn only valid JSON in the required summary shape. Do not add markdown or prose.`,
    };
    const result =
      options.stream && options.onSummaryDelta
        ? await completeJSONStream(summaryOptions, options.stream, options.call, {
            onDelta: options.onSummaryDelta,
          })
        : await completeJSON(summaryOptions, options.call);

    const consistentFailures = result.data.top_failures.filter(
      (failure) => runs[failure.critic]?.status === "success",
    );
    if (consistentFailures.length === 0) {
      throw new Error("The summary named only failed critics; it was rejected as inconsistent with the report.");
    }

    return {
      status: "success",
      summary: result.data.summary,
      top_failures: consistentFailures,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      status: "failure",
      error: error instanceof Error ? error.message : "The summary call failed.",
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function runAnalysis(options: RunAnalysisOptions): Promise<AnalysisReport> {
  const startedAt = Date.now();
  const content = options.input.content;
  if (content.trim().length < 40) throw new Error("Content must be at least 40 characters.");
  if (content.length > 30_000) throw new Error("Content must be at most 30,000 characters.");

  const controller = new AbortController();
  const deadline = setTimeout(() => {
    controller.abort(new DOMException("120-second analysis deadline reached.", "TimeoutError"));
  }, PIPELINE_DEADLINE_MS);

  const onParentAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onParentAbort, { once: true });

  const effectiveOptions: RunAnalysisOptions = { ...options, signal: controller.signal };
  const runs: CriticRunMap = {};

  try {
    const settled = await Promise.allSettled(
      CRITIC_IDS.map((critic) => runOneCritic(critic, effectiveOptions, controller.signal)),
    );

    CRITIC_IDS.forEach((critic, index) => {
      const outcome = settled[index];
      if (outcome.status === "fulfilled") {
        runs[critic] = outcome.value;
        return;
      }
      runs[critic] = {
        status: "failure",
        critic,
        error: {
          stage: "transport",
          code: "unsettled_failure",
          message: outcome.reason instanceof Error ? outcome.reason.message : "Critic failed unexpectedly.",
          retryable: true,
          attempts: 1,
        },
        cached: false,
        provider: options.settings.providerId,
        model: options.settings.model,
        latencyMs: 0,
      };
    });

    const risk = computeRisk(runs);
    const conflicts = detectFixConflicts(runs);
    const summary = await runSummary(effectiveOptions, runs, controller.signal);
    const persona = PERSONAS.find((entry) => entry.id === options.input.personaId);
    const provider = getProvider(options.settings.providerId);

    return {
      schemaVersion: 1,
      id: makeId(),
      createdAt: new Date().toISOString(),
      contentHash: await sha256Hex(content),
      content,
      personaId: options.input.personaId,
      personaLabel: persona?.label ?? "General reader",
      provider: {
        id: options.settings.providerId,
        name: provider.name,
        model: options.settings.model,
        baseUrl: options.settings.baseUrl,
        jsonMode: options.settings.supportsJsonMode,
        mode: options.settings.mode,
      },
      runs,
      risk,
      summary,
      conflicts,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}

export interface RetryCriticOptions {
  critic: CriticId;
  input: AnalysisInput;
  settings: AppSettings;
  apiKey?: string;
  call: ProviderCaller;
  cache?: CriticCacheAdapter;
  signal?: AbortSignal;
}

/** Retries exactly one critic, never silently reusing its failed cache slot. */
export async function retryCritic(options: RetryCriticOptions): Promise<CriticRun> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("30-second critic deadline reached.", "TimeoutError")), 35_000);
  try {
    return await runOneCritic(
      options.critic,
      {
        input: options.input,
        settings: options.settings,
        apiKey: options.apiKey,
        call: options.call,
        cache: options.cache,
        signal: options.signal,
      },
      controller.signal,
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface RewriteOptions {
  content: string;
  personaId: AnalysisInput["personaId"];
  fixes: FixOption[];
  settings: AppSettings;
  apiKey?: string;
  call: ProviderCaller;
  signal?: AbortSignal;
  stream?: StreamCaller;
  onDelta?: (delta: string) => void;
}

export interface RewriteResult {
  rewritten_content: string;
  changes: RewriteChange[];
  notes: string;
  latencyMs: number;
  correctiveRetryUsed: boolean;
}

export async function generateRewrite(options: RewriteOptions): Promise<RewriteResult> {
  if (options.fixes.length === 0) throw new Error("Select at least one fix before rewriting.");
  const startedAt = Date.now();
  const rewriteOptions = {
    providerId: options.settings.providerId,
    baseUrl: options.settings.baseUrl,
    model: options.settings.model,
    apiKey: options.apiKey,
    supportsJsonMode: options.settings.supportsJsonMode,
    messages: [
      { role: "system" as const, content: rewriteSystemPrompt() },
      { role: "user" as const, content: rewriteUserPrompt(options.content, options.personaId, options.fixes) },
    ],
    temperature: 0.4,
    maxTokens: 5_000,
    timeoutMs: 60_000,
    signal: options.signal,
    schema: rewriteSchema,
    correctivePrompt: (error: { issues: Array<{ message: string }> }, raw: string) =>
      `Your rewrite failed validation: ${error.issues.map((issue) => issue.message).join("; ")}.\nPrevious response:\n${raw.slice(0, 1600)}\nRequired shape:\n${minimalRewriteExample()}\nReturn only valid JSON in the required rewrite shape. Keep rewritten_content complete.`,
  };

  const result =
    options.stream && options.onDelta
      ? await completeJSONStream(rewriteOptions, options.stream, options.call, { onDelta: options.onDelta })
      : await completeJSON(rewriteOptions, options.call);

  return {
    rewritten_content: result.data.rewritten_content,
    changes: result.data.changes as RewriteChange[],
    notes: result.data.notes,
    latencyMs: Date.now() - startedAt,
    correctiveRetryUsed: result.correctiveRetryUsed,
  };
}
