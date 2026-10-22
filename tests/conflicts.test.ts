import { describe, expect, it } from "vitest";
import { detectFixConflicts, selectFixes } from "@/lib/conflicts";
import type { CriticId, CriticRunMap } from "@/lib/types";

function run(critic: CriticId, fix: string): CriticRunMap[CriticId] {
  return {
    status: "success",
    critic,
    result: {
      failure_scenario: "A sufficiently detailed failure scenario for conflict detection.",
      evidence_quote: null,
      sub_scores: {},
      probability: 0.5,
      suggested_fix: fix,
    },
    probability: 0.5,
    grounding: "unverified",
    cached: false,
    provider: "openrouter",
    model: "glm",
    jsonMode: true,
    latencyMs: 1,
    attempts: 1,
  };
}

describe("fix conflicts", () => {
  it("detects an increase/decrease conflict on the same topic", () => {
    const runs: CriticRunMap = {
      seo: run("seo", "Add the exact keyword phrase to the title and repeat it in the opening."),
      compliance: run("compliance", "Remove the unqualified claim about guaranteed outcomes."),
    };
    const conflicts = detectFixConflicts(runs);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].topic).toBe("claims");
    expect(conflicts[0].options.map((option) => option.critic).sort()).toEqual(["compliance", "seo"]);
  });

  it("does not invent a conflict for independent fixes", () => {
    const runs: CriticRunMap = {
      seo: run("seo", "Add the exact keyword phrase to the title."),
      behavioral: run("behavioral", "Shorten the opening preamble and move the CTA lower."),
    };
    expect(detectFixConflicts(runs)).toHaveLength(0);
  });

  it("suppresses the unchosen fix and blocks rewrite until resolved", () => {
    const runs: CriticRunMap = {
      seo: run("seo", "Add the exact keyword phrase to the title."),
      compliance: run("compliance", "Remove the unqualified claim about guaranteed outcomes."),
    };
    const conflicts = detectFixConflicts(runs);
    const unresolved = selectFixes(runs, conflicts, {});
    expect(unresolved.unresolved).toHaveLength(1);
    expect(unresolved.fixes).toHaveLength(0);

    const resolved = selectFixes(runs, conflicts, { [conflicts[0].id]: "compliance" });
    expect(resolved.unresolved).toHaveLength(0);
    expect(resolved.fixes).toHaveLength(1);
    expect(resolved.fixes[0].critic).toBe("compliance");
  });

  it("includes all non-conflicting fixes", () => {
    const runs: CriticRunMap = {
      seo: run("seo", "Add the exact keyword phrase to the title."),
      behavioral: run("behavioral", "Shorten the opening preamble and move the CTA lower."),
      competitive: run("competitive", "Replace the adjective stack with a benchmark."),
    };
    const { fixes, unresolved } = selectFixes(runs, [], {});
    expect(unresolved).toHaveLength(0);
    expect(fixes).toHaveLength(3);
  });
});
