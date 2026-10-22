import { findModel, getProvider } from "@/lib/providers";
import type { AppSettings } from "@/lib/types";

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  inputUsd: number;
  outputUsd: number;
  priced: boolean;
  modelLabel: string;
  premium: boolean;
}

/**
 * Conservative analysis-only estimate: four critics + one summary call.
 * Rewrite is priced separately when the user requests it.
 */
export function estimateAnalysisCost(settings: AppSettings, content: string, calls = 5): CostEstimate {
  const preset = getProvider(settings.providerId);
  const model = findModel(preset, settings.model);
  const contentTokens = Math.ceil(content.length / 4);
  const promptOverheadTokens = 1_400;
  const outputTokensPerCall = 720;
  const inputTokens = calls * (contentTokens + promptOverheadTokens);
  const outputTokens = calls * outputTokensPerCall;
  const priced = Boolean(model && (model.inputPricePerMTok > 0 || model.outputPricePerMTok > 0));
  const inputUsd = ((model?.inputPricePerMTok ?? 0) * inputTokens) / 1_000_000;
  const outputUsd = ((model?.outputPricePerMTok ?? 0) * outputTokens) / 1_000_000;

  return {
    inputTokens,
    outputTokens,
    estimatedUsd: Number((inputUsd + outputUsd).toFixed(4)),
    inputUsd: Number(inputUsd.toFixed(4)),
    outputUsd: Number(outputUsd.toFixed(4)),
    priced,
    modelLabel: model?.label ?? settings.model,
    premium: (model?.outputPricePerMTok ?? 0) > 5,
  };
}

export function needsBudgetConfirmation(
  estimate: CostEstimate,
  settings: AppSettings,
): { required: boolean; reason?: string } {
  if (!estimate.priced) return { required: false };
  if (estimate.estimatedUsd > settings.budgetCeilingUsd) {
    return {
      required: true,
      reason: `Estimated analysis cost ($${estimate.estimatedUsd.toFixed(3)}) exceeds your $${settings.budgetCeilingUsd.toFixed(2)} ceiling.`,
    };
  }
  if (estimate.premium) {
    return {
      required: true,
      reason: `${estimate.modelLabel} is a premium model (above $5 / 1M output tokens). The estimated analysis cost is $${estimate.estimatedUsd.toFixed(3)}.`,
    };
  }
  return { required: false };
}
