import { describe, expect, it } from "vitest";
import seoFewshot from "@/agents/fewshot/seo.json";
import complianceFewshot from "@/agents/fewshot/compliance.json";
import behavioralFewshot from "@/agents/fewshot/behavioral.json";
import competitiveFewshot from "@/agents/fewshot/competitive.json";
import { CRITICS } from "@/lib/critics";
import { criticOutputSchemas, rewriteSchema, summarySchema } from "@/lib/schemas";
import { getSampleReport } from "@/lib/sample";
import type { CriticId } from "@/lib/types";

const FEWSHOTS = {
  seo: seoFewshot,
  compliance: complianceFewshot,
  behavioral: behavioralFewshot,
  competitive: competitiveFewshot,
};

describe("critic schemas and few-shot anchors", () => {
  it("ships exactly four critics with matching schema keys", () => {
    expect(CRITICS).toHaveLength(4);
    expect(Object.keys(criticOutputSchemas).sort()).toEqual(
      ["behavioral", "competitive", "compliance", "seo"],
    );
  });

  it("keeps the output schema stable", () => {
    const shapes = Object.fromEntries(
      CRITICS.map((critic) => [critic.id, Object.keys(criticOutputSchemas[critic.id].shape)]),
    );
    expect(shapes).toMatchInlineSnapshot(`
      {
        "behavioral": [
          "failure_scenario",
          "evidence_quote",
          "sub_scores",
          "probability",
          "suggested_fix",
        ],
        "competitive": [
          "failure_scenario",
          "evidence_quote",
          "sub_scores",
          "probability",
          "suggested_fix",
        ],
        "compliance": [
          "failure_scenario",
          "evidence_quote",
          "sub_scores",
          "probability",
          "suggested_fix",
        ],
        "seo": [
          "failure_scenario",
          "evidence_quote",
          "sub_scores",
          "probability",
          "suggested_fix",
        ],
      }
    `);
  });

  it("has two examples per critic and every quote is a real substring", () => {
    for (const critic of CRITICS) {
      const file = FEWSHOTS[critic.id as CriticId];
      expect(file.examples).toHaveLength(2);
      for (const example of file.examples) {
        const parsed = criticOutputSchemas[critic.id].safeParse(example.output);
        expect(parsed.success).toBe(true);
        if (example.output.evidence_quote !== null) {
          expect(example.input.includes(example.output.evidence_quote)).toBe(true);
        }
      }
    }
  });

  it("validates the sample report critic evidence against the content", () => {
    const report = getSampleReport();
    for (const run of Object.values(report.runs)) {
      if (run?.status !== "success") continue;
      if (run.result.evidence_quote) {
        expect(report.content.includes(run.result.evidence_quote)).toBe(true);
      }
    }
    expect(summarySchema.safeParse(report.summary.status === "success" ? {
      summary: report.summary.summary,
      top_failures: report.summary.top_failures,
    } : null).success).toBe(true);
  });

  it("validates a complete rewrite shape", () => {
    const parsed = rewriteSchema.safeParse({
      rewritten_content: "A complete rewritten paragraph that is long enough to validate.",
      changes: [
        {
          critic: "compliance",
          before: "guaranteed",
          after: "typically",
          rationale: "Removes the unsubstantiated guarantee.",
        },
      ],
      notes: "",
    });
    expect(parsed.success).toBe(true);
  });
});
