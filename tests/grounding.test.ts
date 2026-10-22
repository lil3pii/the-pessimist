import { describe, expect, it } from "vitest";
import { generateCritic } from "@/lib/criticEngine";
import type { LLMResponse, ProviderCaller } from "@/lib/llm";
import type { CriticOutput } from "@/lib/types";

const content = "Our platform guarantees a 300% revenue lift in thirty days. No other platform comes close.";

const invalidQuote: CriticOutput = {
  failure_scenario: "The page makes an absolute revenue claim that no evidence on the page supports, creating trust and regulatory exposure.",
  evidence_quote: "a 300% revenue lift in 30 days",
  sub_scores: { intent_alignment: 8, title_body_coherence: 8, topic_coverage: 7 },
  probability: 0.77,
  suggested_fix: "Replace the guarantee with the measured result, the sample size, and the observation window.",
};

const validQuote: CriticOutput = {
  ...invalidQuote,
  evidence_quote: "guarantees a 300% revenue lift in thirty days",
  sub_scores: { intent_alignment: 7, title_body_coherence: 7, topic_coverage: 6 },
  probability: 0.67,
};

function callerWith(outputs: string[]): ProviderCaller {
  let index = 0;
  return async (options) => {
    const contentToReturn = outputs[Math.min(index, outputs.length - 1)];
    index += 1;
    return {
      content: contentToReturn,
      usage: {},
      latencyMs: 1,
      attempts: 1,
      providerId: options.providerId,
      model: options.model,
      jsonMode: true,
    } satisfies LLMResponse;
  };
}

const config = {
  providerId: "openrouter" as const,
  baseUrl: "https://openrouter.ai/api/v1",
  model: "z-ai/glm-5.3-flash",
  apiKey: "test",
  supportsJsonMode: true,
  timeoutMs: 5_000,
};

describe("deterministic grounding check", () => {
  it("retries a hallucinated quote once and accepts the corrected exact quote", async () => {
    const caller = callerWith([JSON.stringify(invalidQuote), JSON.stringify(validQuote)]);
    const result = await generateCritic("seo", content, "skeptical-practitioner", config, caller);
    expect(result.grounding).toBe("verified");
    expect(result.result.evidence_quote).toBe(validQuote.evidence_quote);
    expect(content.includes(result.result.evidence_quote ?? "")).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("rejects the critic after a second hallucinated quote", async () => {
    const caller = callerWith([JSON.stringify(invalidQuote), JSON.stringify(invalidQuote)]);
    await expect(
      generateCritic("seo", content, "skeptical-practitioner", config, caller),
    ).rejects.toMatchObject({ stage: "grounding" });
  });

  it("accepts an explicit null quote as unverified rather than failing the critic", async () => {
    const nullQuote = { ...validQuote, evidence_quote: null };
    const caller = callerWith([JSON.stringify(nullQuote)]);
    const result = await generateCritic("seo", content, "skeptical-practitioner", config, caller);
    expect(result.grounding).toBe("unverified");
    expect(result.result.evidence_quote).toBeNull();
  });

  it("recomputes probability from the rubric instead of trusting the model field", async () => {
    const caller = callerWith([JSON.stringify(validQuote)]);
    const result = await generateCritic("seo", content, "skeptical-practitioner", config, caller);
    // .4*7 + .3*7 + .3*6 = 6.7 => .67
    expect(result.probability).toBe(0.67);
    expect(result.result.probability).toBe(0.67);
  });
});
