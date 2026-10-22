import { z } from "zod";
import { CRITICS, getCritic } from "@/lib/critics";
import { CRITIC_IDS, type CriticId, type CriticSpec } from "@/lib/types";

const subScore = z
  .number()
  .finite()
  .min(0, "Sub-scores must be between 0 and 10")
  .max(10, "Sub-scores must be between 0 and 10");

export function criticOutputSchema(spec: CriticSpec) {
  const shape = Object.fromEntries(spec.dimensions.map((dimension) => [dimension.key, subScore]));
  return z
    .object({
      failure_scenario: z.string().trim().min(20).max(1400),
      evidence_quote: z.string().min(1).max(1200).nullable(),
      sub_scores: z.object(shape).strict(),
      probability: z.number().finite().min(0).max(1),
      suggested_fix: z.string().trim().min(10).max(1400),
    })
    .strict();
}

export const criticOutputSchemas = Object.fromEntries(
  CRITICS.map((critic) => [critic.id, criticOutputSchema(critic)]),
) as Record<CriticId, ReturnType<typeof criticOutputSchema>>;

export type RawCriticOutput = z.infer<ReturnType<typeof criticOutputSchema>>;

export const summarySchema = z
  .object({
    summary: z.string().trim().min(40).max(2400),
    top_failures: z
      .array(
        z
          .object({
            critic: z.enum(CRITIC_IDS),
            scenario: z.string().trim().min(15).max(500),
            why_it_matters: z.string().trim().min(15).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

export type RawSummary = z.infer<typeof summarySchema>;

export const rewriteSchema = z
  .object({
    rewritten_content: z.string().trim().min(20).max(30_000),
    changes: z
      .array(
        z
          .object({
            critic: z.enum([...CRITIC_IDS, "editorial"]),
            before: z.string().max(1200),
            after: z.string().max(1200),
            rationale: z.string().min(5).max(800),
          })
          .strict(),
      )
      .min(1)
      .max(18),
    notes: z.string().max(1200),
  })
  .strict();

export type RawRewrite = z.infer<typeof rewriteSchema>;

export const providerConfigSchema = z
  .object({
    providerId: z.enum([
      "openai",
      "anthropic",
      "deepseek",
      "openrouter",
      "groq",
      "zhipu",
      "github",
      "ollama",
      "custom",
    ]),
    baseUrl: z.string().min(1).max(500),
    model: z.string().min(1).max(200),
    apiKey: z.string().max(5000).optional(),
    supportsJsonMode: z.boolean(),
  })
  .strict();

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const chatRequestSchema = providerConfigSchema
  .extend({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["system", "user", "assistant"]),
            content: z.string().min(1).max(120_000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(16_000).optional(),
    stream: z.boolean().optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const analyzeApiSchema = z
  .object({
    action: z.enum(["chat", "analyze", "ping"]),
    request: chatRequestSchema.optional(),
    config: providerConfigSchema.optional(),
    input: z
      .object({
        content: z.string().min(40).max(30_000),
        personaId: z.enum([
          "skeptical-practitioner",
          "time-poor-executive",
          "technical-evaluator",
          "first-time-buyer",
          "returning-reader",
        ]),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === "chat" && !value.request) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "request is required for chat", path: ["request"] });
    }
    if ((value.action === "ping" || value.action === "analyze") && !value.config) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "config is required for this action", path: ["config"] });
    }
    if (value.action === "analyze" && !value.input) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "input is required for analyze", path: ["input"] });
    }
  });

export type AnalyzeApiRequest = z.infer<typeof analyzeApiSchema>;

export function minimalExample(spec: CriticSpec): string {
  const subScores = Object.fromEntries(spec.dimensions.map((dimension) => [dimension.key, 5]));
  return JSON.stringify(
    {
      failure_scenario: "A concrete description of how this content fails for the selected persona.",
      evidence_quote: "an exact substring copied from the content",
      sub_scores: subScores,
      probability: 0.5,
      suggested_fix: "A specific, executable edit that reduces this failure risk.",
    },
    null,
    2,
  );
}

export function minimalSummaryExample(): string {
  return JSON.stringify(
    {
      summary: "Two or three sentences describing the dominant failure pattern and what to fix first.",
      top_failures: [
        {
          critic: "compliance",
          scenario: "The central outcome claim is unsubstantiated.",
          why_it_matters: "It creates regulatory exposure and undermines trust.",
        },
      ],
    },
    null,
    2,
  );
}

export function minimalRewriteExample(): string {
  return JSON.stringify(
    {
      rewritten_content: "The complete rewritten content.",
      changes: [
        {
          critic: "seo",
          before: "Original phrase",
          after: "Replacement phrase",
          rationale: "Why this change addresses the selected fix.",
        },
      ],
      notes: "Any unresolved tradeoff.",
    },
    null,
    2,
  );
}

export function getCriticOutputSchema(criticId: string) {
  return criticOutputSchemas[getCritic(criticId).id];
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "root"}: ${issue.message}`)
    .join("; ");
}
