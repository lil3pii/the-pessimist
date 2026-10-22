import { describe, expect, it } from "vitest";
import { LLMError, type LLMResponse, type ProviderCaller } from "@/lib/llm";
import { runAnalysis } from "@/lib/pipeline";
import { getSampleReport } from "@/lib/sample";
import type { AppSettings, CriticId, CriticOutput } from "@/lib/types";

const settings: AppSettings = {
  providerId: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "z-ai/glm-5.3-flash",
  supportsJsonMode: true,
  mode: "proxy",
  allowAnthropicDirect: false,
  budgetCeilingUsd: 1,
};

const sample = getSampleReport();
const outputs = Object.fromEntries(
  Object.entries(sample.runs).map(([critic, run]) => [
    critic,
    run && run.status === "success" ? run.result : null,
  ]),
) as Record<CriticId, CriticOutput | null>;

function criticFromSystem(system: string): CriticId | null {
  if (system.includes("The SEO Critic")) return "seo";
  if (system.includes("The Compliance Critic")) return "compliance";
  if (system.includes("The Behavioral Critic")) return "behavioral";
  if (system.includes("The Competitive Critic")) return "competitive";
  return null;
}

function fakeCaller(onCall?: (critic: CriticId | "summary", call: number) => void): ProviderCaller {
  let calls = 0;
  return async (options) => {
    calls += 1;
    const system = options.messages.find((message) => message.role === "system")?.content ?? "";
    let content: string;

    if (system.includes("lead analyst writing the executive readout")) {
      onCall?.("summary", calls);
      content = JSON.stringify({
        summary:
          "The page asks for commitment before it has earned belief. The compliance claim and the interchangeable positioning are the two failures to repair first.",
        top_failures: [
          {
            critic: "compliance",
            scenario: "The SOC 2 and absolute busywork claims are unsupported.",
            why_it_matters: "They create a vendor-risk signal in enterprise review.",
          },
          {
            critic: "competitive",
            scenario: "The product is described with category adjectives only.",
            why_it_matters: "A buyer has no mechanism to compare.",
          },
        ],
      });
    } else {
      const critic = criticFromSystem(system);
      if (!critic) throw new Error(`No critic matched system prompt: ${system.slice(0, 80)}`);
      onCall?.(critic, calls);
      const output = outputs[critic];
      if (!output) throw new Error("Missing fixture");
      content = JSON.stringify(output);
    }

    return {
      content,
      usage: {},
      latencyMs: 5,
      attempts: 1,
      providerId: options.providerId,
      model: options.model,
      jsonMode: options.supportsJsonMode,
    } satisfies LLMResponse;
  };
}

describe("analysis orchestrator", () => {
  it("runs four critics, computes risk deterministically, and makes one summary call", async () => {
    const seen: Array<CriticId | "summary"> = [];
    const report = await runAnalysis({
      input: { content: sample.content, personaId: "time-poor-executive" },
      settings,
      apiKey: "test",
      call: fakeCaller((kind) => seen.push(kind)),
    });

    expect(report.runs.compliance?.status).toBe("success");
    expect(report.runs.seo?.status).toBe("success");
    expect(report.risk.score).toBe(0.7635);
    expect(report.risk.coverage).toBe(1);
    expect(report.risk.level).toBe("red");
    expect(report.summary.status).toBe("success");
    expect(report.conflicts.length).toBeGreaterThan(0);
    expect(seen.filter((kind) => kind === "summary")).toHaveLength(1);
    expect(seen.filter((kind) => kind !== "summary")).toHaveLength(4);
    expect(report.contentHash).toHaveLength(64);
  });

  it("tolerates one critic failure and reduces coverage instead of inventing a zero", async () => {
    const base = fakeCaller();
    const caller: ProviderCaller = async (options) => {
      const system = options.messages.find((message) => message.role === "system")?.content ?? "";
      if (system.includes("The SEO Critic")) {
        throw new LLMError("critic exploded", { stage: "transport", retryable: false });
      }
      return base(options);
    };

    const report = await runAnalysis({
      input: { content: sample.content, personaId: "time-poor-executive" },
      settings,
      apiKey: "test",
      call: caller,
    });

    expect(report.runs.seo?.status).toBe("failure");
    expect(report.runs.compliance?.status).toBe("success");
    expect(report.risk.coverage).toBe(0.75);
    expect(report.risk.score).toBe(0.7713);
    expect(report.summary.status).toBe("success");
  });

  it("still returns critic evidence when the summary call fails", async () => {
    const base = fakeCaller();
    const caller: ProviderCaller = async (options) => {
      const system = options.messages.find((message) => message.role === "system")?.content ?? "";
      if (system.includes("lead analyst")) {
        throw new LLMError("summary unavailable", { stage: "transport", retryable: true });
      }
      return base(options);
    };

    const report = await runAnalysis({
      input: { content: sample.content, personaId: "time-poor-executive" },
      settings,
      apiKey: "test",
      call: caller,
    });

    expect(report.summary.status).toBe("failure");
    expect(report.risk.score).toBe(0.7635);
    expect(report.runs.compliance?.status).toBe("success");
  });
});
