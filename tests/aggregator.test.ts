import { describe, expect, it } from "vitest";
import { computeRisk, riskLevel } from "@/lib/aggregator";
import type { CriticRun, CriticRunMap } from "@/lib/types";

function success(critic: CriticRun["critic"], probability: number): CriticRun {
  return {
    status: "success",
    critic,
    result: {
      failure_scenario: "A sufficiently detailed failure scenario for testing the aggregator.",
      evidence_quote: "evidence",
      sub_scores: { a: probability * 10 },
      probability,
      suggested_fix: "A sufficiently detailed suggested fix for the test.",
    },
    probability,
    grounding: "verified",
    cached: false,
    provider: "openrouter",
    model: "z-ai/glm-5.3-flash",
    jsonMode: true,
    latencyMs: 10,
    attempts: 1,
  };
}

function failure(critic: CriticRun["critic"]): CriticRun {
  return {
    status: "failure",
    critic,
    error: {
      stage: "timeout",
      code: "timeout",
      message: "timed out",
      retryable: true,
      attempts: 1,
    },
    cached: false,
    provider: "openrouter",
    model: "z-ai/glm-5.3-flash",
    latencyMs: 10,
  };
}

describe("deterministic aggregator", () => {
  it("matches the documented weighted formula for a full run", () => {
    const runs: CriticRunMap = {
      compliance: success("compliance", 0.8),
      seo: success("seo", 0.6),
      behavioral: success("behavioral", 0.4),
      competitive: success("competitive", 0.2),
    };
    const risk = computeRisk(runs);
    // .35*.8 + .25*.6 + .20*.4 + .20*.2 = .55
    expect(risk.score).toBe(0.55);
    expect(risk.level).toBe("amber");
    expect(risk.coverage).toBe(1);
    expect(risk.contributions.find((entry) => entry.critic === "compliance")?.weighted).toBe(0.28);
  });

  it("excludes a failed critic from both numerator and denominator", () => {
    const runs: CriticRunMap = {
      compliance: success("compliance", 0.9),
      seo: success("seo", 0.5),
      behavioral: failure("behavioral"),
      competitive: success("competitive", 0.5),
    };
    const risk = computeRisk(runs);
    // counted weights .80; numerator .35*.9 + .25*.5 + .2*.5 = .54
    expect(risk.score).toBe(0.675);
    expect(risk.coverage).toBe(0.8);
    expect(risk.contributions.find((entry) => entry.critic === "behavioral")?.counted).toBe(false);
  });

  it("returns null when every critic fails", () => {
    const risk = computeRisk({
      compliance: failure("compliance"),
      seo: failure("seo"),
      behavioral: failure("behavioral"),
      competitive: failure("competitive"),
    });
    expect(risk.score).toBeNull();
    expect(risk.coverage).toBe(0);
  });

  it("uses the exact risk-band boundaries", () => {
    expect(riskLevel(0.4)).toBe("amber");
    expect(riskLevel(0.7)).toBe("amber");
    expect(riskLevel(0.7001)).toBe("red");
    expect(riskLevel(0.3999)).toBe("green");
    expect(riskLevel(null)).toBe("green");
  });
});
