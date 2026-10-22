import type { ProviderId } from "@/lib/providers";

export const CRITIC_IDS = ["seo", "compliance", "behavioral", "competitive"] as const;
export type CriticId = (typeof CRITIC_IDS)[number];

export const CRITIC_WEIGHTS: Record<CriticId, number> = {
  compliance: 0.35,
  seo: 0.25,
  behavioral: 0.2,
  competitive: 0.2,
};

export interface CriticDimension {
  key: string;
  label: string;
  weight: number;
  description: string;
}

export interface CriticSpec {
  id: CriticId;
  name: string;
  shortName: string;
  tagline: string;
  question: string;
  dimensions: readonly CriticDimension[];
  failureModes: readonly string[];
}

export type CriticSubScores = Record<string, number>;

export interface CriticOutput {
  failure_scenario: string;
  evidence_quote: string | null;
  sub_scores: CriticSubScores;
  probability: number;
  suggested_fix: string;
}

export type GroundingStatus = "verified" | "unverified";
export type CriticErrorStage = "transport" | "timeout" | "parse" | "schema" | "grounding" | "configuration";

export interface CriticError {
  stage: CriticErrorStage;
  code: string;
  message: string;
  retryable: boolean;
  attempts: number;
  detail?: string;
}

export interface CriticSuccess {
  status: "success";
  critic: CriticId;
  result: CriticOutput;
  /** Deterministically recomputed from sub_scores and rubric weights. */
  probability: number;
  grounding: GroundingStatus;
  cached: boolean;
  provider: ProviderId;
  model: string;
  jsonMode: boolean;
  latencyMs: number;
  attempts: number;
}

export interface CriticFailure {
  status: "failure";
  critic: CriticId;
  error: CriticError;
  cached: boolean;
  provider: ProviderId;
  model: string;
  latencyMs: number;
}

export type CriticRun = CriticSuccess | CriticFailure;
export type CriticRunMap = Partial<Record<CriticId, CriticRun>>;

export interface RiskContribution {
  critic: CriticId;
  weight: number;
  probability: number | null;
  weighted: number | null;
  counted: boolean;
}

export type RiskLevel = "red" | "amber" | "green";

export interface RiskReport {
  score: number | null;
  level: RiskLevel;
  /** Portion of total critic weight that produced a valid result, 0..1. */
  coverage: number;
  contributions: RiskContribution[];
  formula: string;
}

export interface SummaryTopFailure {
  critic: CriticId;
  scenario: string;
  why_it_matters: string;
}

export interface SummarySuccess {
  status: "success";
  summary: string;
  top_failures: SummaryTopFailure[];
  latencyMs: number;
}

export interface SummaryFailure {
  status: "failure";
  error: string;
  latencyMs: number;
}

export type SummaryRun = SummarySuccess | SummaryFailure;

export interface FixOption {
  critic: CriticId;
  fix: string;
}

export interface FixConflict {
  id: string;
  topic: string;
  title: string;
  explanation: string;
  options: FixOption[];
}

export interface RewriteChange {
  critic: CriticId | "editorial";
  before: string;
  after: string;
  rationale: string;
}

export interface RewriteOutput {
  rewritten_content: string;
  changes: RewriteChange[];
  notes: string;
}

export type AnalysisMode = "proxy" | "direct";

export interface ProviderSnapshot {
  id: ProviderId;
  name: string;
  model: string;
  baseUrl: string;
  jsonMode: boolean;
  mode: AnalysisMode;
}

export const PERSONAS = [
  {
    id: "skeptical-practitioner",
    label: "Skeptical practitioner",
    description: "Has seen every promise. Scans for proof, then leaves.",
  },
  {
    id: "time-poor-executive",
    label: "Time-poor executive",
    description: "Ten seconds, one question: what changes if I act?",
  },
  {
    id: "technical-evaluator",
    label: "Technical evaluator",
    description: "Looks for mechanism, limits, and hidden failure modes.",
  },
  {
    id: "first-time-buyer",
    label: "First-time buyer",
    description: "Motivated but cautious. Needs risk reversal before commitment.",
  },
  {
    id: "returning-reader",
    label: "Returning reader",
    description: "Knows the basics. Wants the new, specific, non-obvious part.",
  },
] as const;

export type PersonaId = (typeof PERSONAS)[number]["id"];

export interface AppSettings {
  providerId: ProviderId;
  baseUrl: string;
  model: string;
  supportsJsonMode: boolean;
  mode: AnalysisMode;
  allowAnthropicDirect: boolean;
  budgetCeilingUsd: number;
}

export interface AnalysisInput {
  content: string;
  personaId: PersonaId;
}

export interface AnalysisReport {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  contentHash: string;
  content: string;
  personaId: PersonaId;
  personaLabel: string;
  provider: ProviderSnapshot;
  runs: CriticRunMap;
  risk: RiskReport;
  summary: SummaryRun;
  conflicts: FixConflict[];
  durationMs: number;
}

export interface CacheEntry<T> {
  version: 1;
  createdAt: number;
  expiresAt: number;
  value: T;
}

export interface CriticCacheValue {
  result: CriticOutput;
  probability: number;
  grounding: GroundingStatus;
  latencyMs: number;
  attempts: number;
  jsonMode: boolean;
}
