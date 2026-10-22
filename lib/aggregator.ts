import {
  CRITIC_IDS,
  CRITIC_WEIGHTS,
  type CriticId,
  type CriticRunMap,
  type RiskContribution,
  type RiskLevel,
  type RiskReport,
} from "@/lib/types";

export function riskLevel(score: number | null): RiskLevel {
  if (score === null) return "green";
  if (score > 0.7) return "red";
  if (score >= 0.4) return "amber";
  return "green";
}

/**
 * Deterministic. An LLM never computes this value.
 *
 *   risk = Σ(w_critic × p_critic) / Σ(w_critic)
 *
 * If a critic fails, it is excluded from BOTH sums and coverage is reduced.
 * Treating a failure as zero would understate risk; treating it as 1 would
 * fabricate it. The report surfaces coverage so the number is never mistaken
 * for a complete analysis.
 */
export function computeRisk(runs: CriticRunMap): RiskReport {
  const contributions: RiskContribution[] = CRITIC_IDS.map((critic) => {
    const run = runs[critic];
    const weight = CRITIC_WEIGHTS[critic];
    if (run?.status === "success") {
      return {
        critic,
        weight,
        probability: run.probability,
        weighted: Number((weight * run.probability).toFixed(6)),
        counted: true,
      };
    }
    return { critic, weight, probability: null, weighted: null, counted: false };
  });

  const counted = contributions.filter((entry) => entry.counted);
  const totalWeight = counted.reduce((sum, entry) => sum + entry.weight, 0);
  const numerator = counted.reduce((sum, entry) => sum + (entry.weighted ?? 0), 0);
  const score = totalWeight > 0 ? Number((numerator / totalWeight).toFixed(4)) : null;

  return {
    score,
    level: riskLevel(score),
    coverage: Number((totalWeight / Object.values(CRITIC_WEIGHTS).reduce((sum, value) => sum + value, 0)).toFixed(4)),
    contributions,
    formula: "Σ(w_critic × p_critic) / Σ(w_critic); compliance .35, seo .25, behavioral .20, competitive .20",
  };
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case "red":
      return "text-risk-red";
    case "amber":
      return "text-risk-amber";
    default:
      return "text-risk-green";
  }
}

export function riskVar(level: RiskLevel): string {
  switch (level) {
    case "red":
      return "var(--risk-red)";
    case "amber":
      return "var(--risk-amber)";
    default:
      return "var(--risk-green)";
  }
}

export function topWeightedCritic(runs: CriticRunMap): CriticId | null {
  const successes = CRITIC_IDS.map((critic) => ({ critic, run: runs[critic] })).filter(
    (entry): entry is { critic: CriticId; run: Extract<NonNullable<CriticRunMap[CriticId]>, { status: "success" }> } =>
      entry.run?.status === "success",
  );
  if (successes.length === 0) return null;
  successes.sort((a, b) => CRITIC_WEIGHTS[b.critic] * b.run.probability - CRITIC_WEIGHTS[a.critic] * a.run.probability);
  return successes[0].critic;
}
