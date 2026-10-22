/**
 * Critic harness.
 *
 *   npm run test:critics -- --mock
 *   OPENROUTER_API_KEY=... ANTHROPIC_API_KEY=... npm run test:critics
 *
 * Real mode runs every critic against three content classes on two provider
 * capability profiles: one with response_format and one without. It skips a
 * provider only when its key is absent, and exits non-zero if no provider ran.
 */
import { generateCritic, toCriticError } from "../lib/criticEngine";
import { callProvider, type LLMResponse, type ProviderCaller } from "../lib/llm";
import { getProvider, type ProviderId } from "../lib/providers";
import type { CriticId, CriticOutput, PersonaId } from "../lib/types";
import { CRITIC_IDS } from "../lib/types";

const args = new Set(process.argv.slice(2));
const mock = args.has("--mock");
const providerArg = [...args].find((arg) => arg.startsWith("--provider="));
const selectedProviders = providerArg
  ? providerArg.split("=")[1].split(",").filter(Boolean)
  : ["openrouter", "anthropic"];

interface Fixture {
  name: "short" | "long" | "legal-claim-heavy";
  personaId: PersonaId;
  content: string;
}

const FIXTURES: Fixture[] = [
  {
    name: "short",
    personaId: "time-poor-executive",
    content:
      "We are the #1 platform for every team. No other tool comes close. Start your free trial today.",
  },
  {
    name: "long",
    personaId: "technical-evaluator",
    content: `How we made CSV imports resumable

CSV imports fail in the least convenient place: halfway through a file someone needs by Friday. We rebuilt our importer around a queue. Every 500 rows, the worker writes a checkpoint. If the browser closes at row 40,000, the next run resumes at row 40,001. The queue is durable for seven days.

The old importer parsed the entire file before rendering progress. For a 2.1 million row file, that meant 18 minutes of a blank screen. The new one shows the first row in 300 milliseconds and finishes the same file in 4 minutes and 12 seconds on the same 8-core machine. We trade a small fixed latency for a large reduction in worst-case wait.

What this does not solve: validation errors still stop the run. We surface the first 100 errors with row numbers and let the operator download the failure set. A future version will allow skip-and-continue for known error classes. The benchmark methodology and the raw timing logs are in the repository.

If you only import files under 10,000 rows, the old path is faster. We keep it behind a toggle.`,
  },
  {
    name: "legal-claim-heavy",
    personaId: "first-time-buyer",
    content: `Our supplement cures insomnia in 97% of users. Unlike prescription medication, it has no side effects and works from the first night. Clinically proven by leading scientists.

Thousands of customers have stopped wasting money on doctors. Order now and receive a free consultation with our wellness expert. Results are guaranteed or your money back.

This is not medical advice. Individual results may vary.`,
  },
];

interface ProviderRun {
  providerId: ProviderId;
  model: string;
  jsonMode: boolean;
  hasKey: boolean;
}

function envKey(providerId: ProviderId): string | undefined {
  const map: Partial<Record<ProviderId, string>> = {
    openrouter: process.env.OPENROUTER_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    zhipu: process.env.ZHIPU_API_KEY,
    github: process.env.GITHUB_MODELS_TOKEN,
  };
  return map[providerId];
}

function realProviders(): ProviderRun[] {
  const defaults: Record<string, { providerId: ProviderId; model: string; jsonMode: boolean }> = {
    openrouter: { providerId: "openrouter", model: "z-ai/glm-5.3-flash", jsonMode: true },
    anthropic: { providerId: "anthropic", model: "claude-sonnet-4-5", jsonMode: false },
    deepseek: { providerId: "deepseek", model: "deepseek-chat", jsonMode: true },
    zhipu: { providerId: "zhipu", model: "glm-5.3-flash", jsonMode: true },
  };
  return selectedProviders
    .map((id) => defaults[id])
    .filter((entry): entry is { providerId: ProviderId; model: string; jsonMode: boolean } => Boolean(entry))
    .map((entry) => ({
      ...entry,
      hasKey: Boolean(envKey(entry.providerId)),
    }));
}

function firstSentence(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^[\s\S]{10,220}?[.!?](?:\s|$)/);
  return (match?.[0] ?? trimmed.slice(0, 180)).trim();
}

function mockOutput(critic: CriticId, content: string): CriticOutput {
  const quote = firstSentence(content);
  const dimensions: Record<CriticId, string[]> = {
    seo: ["intent_alignment", "title_body_coherence", "topic_coverage"],
    compliance: ["claim_substantiation", "jurisdictional_risk", "disclosure_adequacy"],
    behavioral: ["cta_timing", "length_patience", "cognitive_load"],
    competitive: ["differentiation", "specificity", "evidence_uniqueness"],
  };
  return {
    failure_scenario: `The ${critic} critic predicts a concrete failure for this fixture, grounded in the opening claim. The causal chain is intentionally deterministic for the harness.`,
    evidence_quote: quote,
    sub_scores: Object.fromEntries(dimensions[critic].map((key, index) => [key, 5 + index])),
    probability: 0.6,
    suggested_fix: `A specific ${critic} edit that would reduce the dominant failure mode without inventing new facts.`,
  };
}

async function runMock(fixture: Fixture): Promise<void> {
  const caller: ProviderCaller = async (options) => {
    const system = options.messages.find((message) => message.role === "system")?.content ?? "";
    const critic = CRITIC_IDS.find((id) => system.includes(`${id.toUpperCase()}`) || system.includes(labelFor(id)));
    if (!critic) throw new Error("Mock could not identify critic from prompt.");
    return {
      content: JSON.stringify(mockOutput(critic, fixture.content)),
      usage: {},
      latencyMs: 1,
      attempts: 1,
      providerId: options.providerId,
      model: options.model,
      jsonMode: options.supportsJsonMode,
    } satisfies LLMResponse;
  };

  for (const critic of CRITIC_IDS) {
    const generated = await generateCritic(
      critic,
      fixture.content,
      fixture.personaId,
      {
        providerId: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "mock-glm",
        apiKey: "mock",
        supportsJsonMode: true,
        timeoutMs: 5_000,
      },
      caller,
    );
    console.log(
      JSON.stringify(
        {
          fixture: fixture.name,
          critic,
          provider: "mock",
          model: "mock-glm",
          jsonMode: true,
          grounding: generated.grounding,
          probability: generated.probability,
          attempts: generated.attempts,
          result: generated.result,
        },
        null,
        2,
      ),
    );
  }
}

function labelFor(critic: CriticId): string {
  switch (critic) {
    case "seo":
      return "The SEO Critic";
    case "compliance":
      return "The Compliance Critic";
    case "behavioral":
      return "The Behavioral Critic";
    case "competitive":
      return "The Competitive Critic";
  }
}

async function main() {
  if (mock) {
    console.log("Running deterministic mock harness: 3 fixtures × 4 critics.\n");
    for (const fixture of FIXTURES) await runMock(fixture);
    console.log("\nMock harness passed. Every critic produced schema-valid, grounded JSON.");
    return;
  }

  const providers = realProviders().filter((provider) => provider.hasKey);
  if (providers.length === 0) {
    console.error(
      "No provider keys found. Set OPENROUTER_API_KEY and/or ANTHROPIC_API_KEY, or run with --mock.",
    );
    process.exit(1);
  }

  let failures = 0;
  let successes = 0;

  for (const provider of providers) {
    const preset = getProvider(provider.providerId);
    console.log(
      `\nProvider: ${preset.name} · model=${provider.model} · json_mode=${provider.jsonMode}`,
    );

    for (const fixture of FIXTURES) {
      console.log(`\nFixture: ${fixture.name} · persona=${fixture.personaId}`);
      for (const critic of CRITIC_IDS) {
        const startedAt = Date.now();
        try {
          const generated = await generateCritic(
            critic,
            fixture.content,
            fixture.personaId,
            {
              providerId: provider.providerId,
              baseUrl: preset.baseUrl,
              model: provider.model,
              apiKey: envKey(provider.providerId),
              supportsJsonMode: provider.jsonMode,
              timeoutMs: 30_000,
            },
            callProvider,
          );
          successes += 1;
          console.log(
            JSON.stringify(
              {
                fixture: fixture.name,
                critic,
                provider: preset.id,
                model: provider.model,
                jsonMode: provider.jsonMode,
                status: "success",
                grounding: generated.grounding,
                probability: generated.probability,
                attempts: generated.attempts,
                latencyMs: Date.now() - startedAt,
                result: generated.result,
              },
              null,
              2,
            ),
          );
        } catch (error) {
          failures += 1;
          console.error(
            JSON.stringify(
              {
                fixture: fixture.name,
                critic,
                provider: preset.id,
                model: provider.model,
                jsonMode: provider.jsonMode,
                status: "failure",
                error: toCriticError(error),
              },
              null,
              2,
            ),
          );
        }
      }
    }
  }

  console.log(`\nCritic harness finished: ${successes} success, ${failures} failure.`);
  if (failures > 0) process.exit(1);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
