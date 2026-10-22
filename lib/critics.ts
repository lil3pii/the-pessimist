import type { CriticSpec } from "@/lib/types";

export const CRITICS: readonly CriticSpec[] = [
  {
    id: "seo",
    name: "The SEO Critic",
    shortName: "SEO",
    tagline: "Will the right reader ever find this?",
    question: "How does this page fail to earn the click, then satisfy the query?",
    dimensions: [
      {
        key: "intent_alignment",
        label: "Search-intent alignment",
        weight: 0.4,
        description: "Risk that the content serves a different intent than the query implies.",
      },
      {
        key: "title_body_coherence",
        label: "Title–body coherence",
        weight: 0.3,
        description: "Risk that the title promises something the body does not deliver.",
      },
      {
        key: "topic_coverage",
        label: "Keyword / topic coverage",
        weight: 0.3,
        description: "Risk that essential sub-topics, entities, or query variants are absent.",
      },
    ],
    failureModes: [
      "Ranking for a query with different commercial intent",
      "Title/body mismatch that triggers pogo-sticking",
      "Missing the sub-question the reader actually came for",
    ],
  },
  {
    id: "compliance",
    name: "The Compliance Critic",
    shortName: "Compliance",
    tagline: "Which sentence creates liability?",
    question: "How does this content create legal, regulatory, or trust exposure?",
    dimensions: [
      {
        key: "claim_substantiation",
        label: "Claim substantiation",
        weight: 0.5,
        description: "Risk from absolute, comparative, or unproven claims.",
      },
      {
        key: "jurisdictional_risk",
        label: "Jurisdictional risk",
        weight: 0.3,
        description: "Risk from rules that differ across markets (health, finance, privacy).",
      },
      {
        key: "disclosure_adequacy",
        label: "Disclosure adequacy",
        weight: 0.2,
        description: "Risk that material limits, sponsorship, or affiliate relationships are hidden.",
      },
    ],
    failureModes: [
      "Unsubstantiated superlative or outcome claim",
      "Regulated advice without qualification",
      "Missing material disclosure",
    ],
  },
  {
    id: "behavioral",
    name: "The Behavioral Critic",
    shortName: "Behavioral",
    tagline: "Where does attention die?",
    question: "How does the reader abandon, skim past, or fail to act?",
    dimensions: [
      {
        key: "cta_timing",
        label: "CTA timing vs. awareness",
        weight: 0.4,
        description: "Risk that the ask arrives before the reader is ready, or after momentum is lost.",
      },
      {
        key: "length_patience",
        label: "Length vs. patience",
        weight: 0.3,
        description: "Risk that length exceeds the patience the persona brings.",
      },
      {
        key: "cognitive_load",
        label: "Cognitive load",
        weight: 0.3,
        description: "Risk from density, jargon, weak hierarchy, or competing asks.",
      },
    ],
    failureModes: [
      "Premature CTA before value is established",
      "Long preamble before the first useful sentence",
      "Too many competing actions in one view",
    ],
  },
  {
    id: "competitive",
    name: "The Competitive Critic",
    shortName: "Competitive",
    tagline: "Why would anyone choose this over the alternative?",
    question: "How does this content lose against a competitor, an incumbent, or doing nothing?",
    dimensions: [
      {
        key: "differentiation",
        label: "Differentiation",
        weight: 0.4,
        description: "Risk that the content occupies the same generic position as everyone else.",
      },
      {
        key: "specificity",
        label: "Specificity vs. generic claims",
        weight: 0.3,
        description: "Risk from claims that could describe any product in the category.",
      },
      {
        key: "evidence_uniqueness",
        label: "Evidence of uniqueness",
        weight: 0.3,
        description: "Risk that unique mechanisms, data, or proof points are absent.",
      },
    ],
    failureModes: [
      "Interchangeable category copy",
      "Features stated without a differentiated mechanism",
      "No proof that the alternative is worse",
    ],
  },
] as const;

export function getCritic(id: string): CriticSpec {
  const critic = CRITICS.find((entry) => entry.id === id);
  if (!critic) throw new Error(`Unknown critic: ${id}`);
  return critic;
}

export function weightedProbability(spec: CriticSpec, subScores: Record<string, number>): number {
  const weighted = spec.dimensions.reduce((sum, dimension) => {
    const score = subScores[dimension.key];
    return sum + (typeof score === "number" ? score : 0) * dimension.weight;
  }, 0);

  return Number((weighted / 10).toFixed(4));
}
