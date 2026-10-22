import { computeRisk } from "@/lib/aggregator";
import { detectFixConflicts } from "@/lib/conflicts";
import type { AnalysisReport, CriticRunMap, SummaryRun } from "@/lib/types";

export const SAMPLE_CONTENT = `Northstar is the AI operations platform every growing team needs.

Trusted by leading companies, our best-in-class solution helps you collaborate better, move faster, and unlock productivity. Unlike other tools, Northstar eliminates busywork entirely.

In today's fast-paced world, teams need a single source of truth. Northstar connects your projects, docs, and conversations in one powerful, easy-to-use workspace. Thousands of teams already rely on it.

How it works
Connect your tools. Let the AI do the rest. Start your free trial today. No credit card required.

Northstar is SOC 2 compliant and uses enterprise-grade security. Customers see dramatic improvements in alignment and efficiency.

The future of work is here. Join the teams choosing a better way.`;

const sampleRuns: CriticRunMap = {
  seo: {
    status: "success",
    critic: "seo",
    result: {
      failure_scenario:
        "The page competes for the broad head term \"AI operations platform\" without owning a specific query. It will earn impressions from teams looking for an integration, a project tracker, or a workflow template, then lose the click to pages whose titles name that exact job.",
      evidence_quote: "Northstar is the AI operations platform every growing team needs.",
      sub_scores: { intent_alignment: 8, title_body_coherence: 7, topic_coverage: 7 },
      probability: 0.74,
      suggested_fix:
        "Add the exact keyword phrase \"AI operations platform for RevOps teams\" to the title and first sentence, then add one section that answers the integration question a RevOps lead actually searches for.",
    },
    probability: 0.74,
    grounding: "verified",
    cached: false,
    provider: "openrouter",
    model: "z-ai/glm-5.3-flash",
    jsonMode: true,
    latencyMs: 4_820,
    attempts: 1,
  },
  compliance: {
    status: "success",
    critic: "compliance",
    result: {
      failure_scenario:
        "The page asserts that the product eliminates busywork entirely and that it is SOC 2 compliant. Neither claim is qualified or linked to evidence. In a regulated buyer's vendor review, this becomes a trust problem first and a procurement blocker second.",
      evidence_quote: "Northstar is SOC 2 compliant and uses enterprise-grade security.",
      sub_scores: { claim_substantiation: 9, jurisdictional_risk: 8, disclosure_adequacy: 7 },
      probability: 0.83,
      suggested_fix:
        "Remove the absolute claim that Northstar eliminates busywork. Replace the SOC 2 sentence with the report date, audit scope, and a link to the trust page.",
    },
    probability: 0.83,
    grounding: "verified",
    cached: false,
    provider: "openrouter",
    model: "z-ai/glm-5.3-flash",
    jsonMode: true,
    latencyMs: 5_210,
    attempts: 1,
  },
  behavioral: {
    status: "success",
    critic: "behavioral",
    result: {
      failure_scenario:
        "The CTA appears before a single concrete outcome has been shown. A time-poor executive reaches \"Start your free trial\" after three paragraphs of category language and leaves with no reason to trade an email address for a demo.",
      evidence_quote: "Start your free trial today.",
      sub_scores: { cta_timing: 7, length_patience: 7, cognitive_load: 6 },
      probability: 0.67,
      suggested_fix:
        "Cut the opening category paragraph and put one measured customer outcome above the trial CTA. Move the \"How it works\" sequence before the second ask.",
    },
    probability: 0.67,
    grounding: "verified",
    cached: false,
    provider: "openrouter",
    model: "z-ai/glm-5.3-flash",
    jsonMode: true,
    latencyMs: 4_450,
    attempts: 1,
  },
  competitive: {
    status: "success",
    critic: "competitive",
    result: {
      failure_scenario:
        "Every differentiator on the page is a category adjective: better collaboration, faster movement, unlocked productivity. A buyer comparing Northstar with an incumbent cannot identify a single mechanism that would change their choice, so the safe option wins.",
      evidence_quote: "best-in-class solution helps you collaborate better, move faster, and unlock productivity",
      sub_scores: { differentiation: 8, specificity: 8, evidence_uniqueness: 7 },
      probability: 0.77,
      suggested_fix:
        "Replace the adjective stack with one named mechanism, one benchmark, and one tradeoff. For example: how the AI resolves conflicting project statuses, measured on a 40-person team.",
    },
    probability: 0.77,
    grounding: "verified",
    cached: false,
    provider: "openrouter",
    model: "z-ai/glm-5.3-flash",
    jsonMode: true,
    latencyMs: 4_960,
    attempts: 1,
  },
};

const sampleSummary: SummaryRun = {
  status: "success",
  summary:
    "The page is legible but not credible. It asks for a trial before showing a single mechanism or proof point, while absolute claims about busywork and compliance create avoidable trust risk. Fix the evidence gap first: the generic positioning and early CTA are symptoms of the same missing specificity.",
  top_failures: [
    {
      critic: "compliance",
      scenario: "An unqualified SOC 2 claim and an absolute busywork claim sit in the trust-critical path.",
      why_it_matters: "Enterprise buyers will treat this as a vendor-risk signal before they evaluate the product.",
    },
    {
      critic: "competitive",
      scenario: "The product is described entirely in interchangeable category adjectives.",
      why_it_matters: "Without a unique mechanism, the incumbent or doing nothing wins by default.",
    },
    {
      critic: "behavioral",
      scenario: "The trial CTA arrives before any concrete outcome is demonstrated.",
      why_it_matters: "The reader is asked to act while the value is still abstract.",
    },
  ],
  latencyMs: 3_220,
};

export function getSampleReport(): AnalysisReport {
  const risk = computeRisk(sampleRuns);
  return {
    schemaVersion: 1,
    id: "sample-report",
    createdAt: new Date().toISOString(),
    contentHash: "d3e7f0b8c1a94b2f8a6d5e3c0b7f1a2d9e8c6b4a3f2e1d0c9b8a7f6e5d4c3b2a",
    content: SAMPLE_CONTENT,
    personaId: "time-poor-executive",
    personaLabel: "Time-poor executive",
    provider: {
      id: "openrouter",
      name: "OpenRouter",
      model: "z-ai/glm-5.3-flash",
      baseUrl: "https://openrouter.ai/api/v1",
      jsonMode: true,
      mode: "proxy",
    },
    runs: sampleRuns,
    risk,
    summary: sampleSummary,
    conflicts: detectFixConflicts(sampleRuns),
    durationMs: 18_640,
  };
}
