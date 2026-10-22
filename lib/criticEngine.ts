import { getCritic, weightedProbability } from "@/lib/critics";
import {
  LLMError,
  StructuredOutputError,
  completeJSON,
  type ProviderCaller,
} from "@/lib/llm";
import {
  criticSystemPrompt,
  criticUserPrompt,
  groundingCorrectionPrompt,
  jsonCorrectionPrompt,
} from "@/lib/prompts";
import { criticOutputSchemas } from "@/lib/schemas";
import type {
  CriticError,
  CriticId,
  CriticOutput,
  GroundingStatus,
  PersonaId,
} from "@/lib/types";
import type { ProviderId } from "@/lib/providers";

export interface CriticCallConfig {
  providerId: ProviderId;
  baseUrl: string;
  model: string;
  apiKey?: string;
  supportsJsonMode: boolean;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface GeneratedCritic {
  result: CriticOutput;
  probability: number;
  grounding: GroundingStatus;
  latencyMs: number;
  attempts: number;
  jsonMode: boolean;
}

export class CriticEngineError extends Error {
  readonly stage: "grounding";
  readonly code: string;
  readonly attempts: number;

  constructor(message: string, attempts: number, code = "grounding_quote_not_found") {
    super(message);
    this.name = "CriticEngineError";
    this.stage = "grounding";
    this.code = code;
    this.attempts = attempts;
  }
}

export function toCriticError(error: unknown, fallbackAttempts = 1): CriticError {
  if (error instanceof CriticEngineError) {
    return {
      stage: "grounding",
      code: error.code,
      message: error.message,
      retryable: true,
      attempts: error.attempts,
    };
  }

  if (error instanceof StructuredOutputError) {
    return {
      stage: error.stage,
      code: error.stage === "parse" ? "invalid_json" : "schema_validation_failed",
      message:
        error.stage === "parse"
          ? "The critic did not return parseable JSON after one corrective retry."
          : "The critic returned JSON that still failed the rubric schema after one corrective retry.",
      detail: error.zodError.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; "),
      retryable: true,
      attempts: error.attempts,
    };
  }

  if (error instanceof LLMError) {
    return {
      stage: error.stage === "timeout" ? "timeout" : error.stage === "configuration" ? "configuration" : "transport",
      code: error.status ? `http_${error.status}` : error.stage,
      message: error.message,
      retryable: error.retryable || error.stage === "transport" || error.stage === "timeout",
      attempts: error.attempts || fallbackAttempts,
    };
  }

  return {
    stage: "transport",
    code: "unknown_error",
    message: error instanceof Error ? error.message : "Unknown critic failure.",
    retryable: true,
    attempts: fallbackAttempts,
  };
}

export async function generateCritic(
  criticId: CriticId,
  content: string,
  personaId: PersonaId,
  config: CriticCallConfig,
  call: ProviderCaller,
): Promise<GeneratedCritic> {
  const spec = getCritic(criticId);
  const schema = criticOutputSchemas[criticId];
  const messages = [
    { role: "system" as const, content: criticSystemPrompt(spec) },
    { role: "user" as const, content: criticUserPrompt(content, personaId) },
  ];

  const startedAt = Date.now();
  const first = await completeJSON(
    {
      providerId: config.providerId,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      supportsJsonMode: config.supportsJsonMode,
      messages,
      temperature: 0.2,
      maxTokens: 1_000,
      timeoutMs: config.timeoutMs,
      signal: config.signal,
      schema,
      correctivePrompt: (error, raw) => jsonCorrectionPrompt(error, spec, raw),
    },
    call,
  );

  let result = first.data as CriticOutput;
  let attempts = first.response.attempts;
  let grounding: GroundingStatus = "unverified";

  if (result.evidence_quote !== null) {
    if (content.includes(result.evidence_quote)) {
      grounding = "verified";
    } else {
      const groundingMessages = [
        ...messages,
        { role: "assistant" as const, content: first.raw.slice(0, 12_000) },
        { role: "user" as const, content: groundingCorrectionPrompt(result.evidence_quote) },
      ];
      const retry = await completeJSON(
        {
          providerId: config.providerId,
          baseUrl: config.baseUrl,
          model: config.model,
          apiKey: config.apiKey,
          supportsJsonMode: config.supportsJsonMode,
          messages: groundingMessages,
          temperature: 0.1,
          maxTokens: 1_000,
          timeoutMs: config.timeoutMs,
          signal: config.signal,
          schema,
          correctivePrompt: (error, raw) => jsonCorrectionPrompt(error, spec, raw),
        },
        call,
      );
      attempts += retry.response.attempts;
      result = retry.data as CriticOutput;
      if (result.evidence_quote !== null && !content.includes(result.evidence_quote)) {
        throw new CriticEngineError(
          "The critic's evidence quote was not found verbatim in the input after a corrective retry. The result was rejected to prevent a hallucinated citation.",
          attempts,
        );
      }
      grounding = result.evidence_quote === null ? "unverified" : "verified";
    }
  }

  const probability = weightedProbability(spec, result.sub_scores);
  const reported = result.probability;
  if (Math.abs(reported - probability) > 0.08) {
    console.info(
      `[critic] probability_recomputed critic=${criticId} reported=${reported.toFixed(3)} computed=${probability.toFixed(3)}`,
    );
  }

  return {
    result: { ...result, probability },
    probability,
    grounding,
    latencyMs: Date.now() - startedAt,
    attempts,
    jsonMode: config.supportsJsonMode,
  };
}
