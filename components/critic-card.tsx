"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, Fingerprint, Quote, RefreshCw, WifiOff } from "lucide-react";
import { getCritic } from "@/lib/critics";
import type { CriticId, CriticRun } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CriticCardProps {
  criticId: CriticId;
  index: number;
  run: CriticRun;
  onRetry: (critic: CriticId) => void;
  retrying: boolean;
  retryDisabled?: boolean;
}

function probabilityTone(probability: number): string {
  if (probability > 0.7) return "text-risk-red";
  if (probability >= 0.4) return "text-risk-amber";
  return "text-risk-green";
}

const STAGE_LABEL: Record<string, string> = {
  grounding: "Grounding rejected",
  schema: "Schema validation failed",
  parse: "JSON parse failed",
  timeout: "Timed out",
  transport: "Provider transport error",
  configuration: "Configuration error",
};

export function CriticCard({ criticId, index, run, onRetry, retrying, retryDisabled }: CriticCardProps) {
  const spec = getCritic(criticId);
  const [copied, setCopied] = useState(false);

  async function copyQuote(quote: string) {
    try {
      await navigator.clipboard.writeText(quote);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="panel relative flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-bone/[0.08] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-bone/25">0{index + 1}</span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.17em] text-bone/80">
              {spec.shortName}
            </p>
            <p className="mt-1 text-[10px] text-bone/30">{spec.tagline}</p>
          </div>
        </div>
        {run.status === "success" ? (
          <div className="text-right">
            <p className={cn("font-mono text-2xl leading-none tabular-nums", probabilityTone(run.probability))}>
              {run.probability.toFixed(2)}
            </p>
            <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-bone/25">
              probability
            </p>
          </div>
        ) : (
          <span className="tag border-risk-red/25 text-risk-red/75">
            <WifiOff className="h-3 w-3" strokeWidth={1.5} />
            failed
          </span>
        )}
      </div>

      {run.status === "success" ? (
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap gap-1.5">
            {run.cached && (
              <span className="tag border-bone/20">
                <RefreshCw className="h-2.5 w-2.5" strokeWidth={1.5} />
                cached 24h
              </span>
            )}
            <span className={cn("tag", run.grounding === "verified" ? "border-risk-green/25 text-risk-green/70" : "border-risk-amber/25 text-risk-amber/70")}>
              <Fingerprint className="h-2.5 w-2.5" strokeWidth={1.5} />
              {run.grounding === "verified" ? "quote verified" : "quote unverified"}
            </span>
            <span className="tag">{run.jsonMode ? "JSON mode" : "prompt JSON"}</span>
          </div>

          <div className="mt-5">
            <p className="eyebrow text-bone/30">Failure scenario</p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-bone/70">{run.result.failure_scenario}</p>
          </div>

          {run.result.evidence_quote ? (
            <div className="mt-5 border-l border-risk-amber/50 bg-bone/[0.035] py-3 pl-4 pr-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Quote className="mt-0.5 h-3 w-3 shrink-0 text-risk-amber/70" strokeWidth={1.5} />
                  <blockquote className="text-[12px] leading-relaxed text-bone/75">
                    {run.result.evidence_quote}
                  </blockquote>
                </div>
                <button
                  type="button"
                  onClick={() => void copyQuote(run.result.evidence_quote ?? "")}
                  className="shrink-0 text-bone/25 transition-colors hover:text-bone/70"
                  aria-label="Copy evidence quote"
                >
                  {copied ? <Check className="h-3 w-3" strokeWidth={1.7} /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 border border-dashed border-bone/10 px-3 py-2.5 text-[10px] leading-relaxed text-bone/30">
              No exact quote was returned. The finding is unverified and should be treated as a
              hypothesis.
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-bone/30">Rubric · failure risk</p>
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-bone/20">0 — 10</span>
            </div>
            <div className="mt-3 space-y-3">
              {spec.dimensions.map((dimension) => {
                const score = run.result.sub_scores[dimension.key] ?? 0;
                return (
                  <div key={dimension.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] text-bone/45">{dimension.label}</span>
                      <span className="font-mono text-[10px] tabular-nums text-bone/60">{score.toFixed(0)}</span>
                    </div>
                    <div className="mt-1.5 h-px w-full bg-bone/10">
                      <div
                        className={cn(
                          "h-full transition-all duration-700",
                          score > 7 ? "bg-risk-red/70" : score >= 4 ? "bg-risk-amber/60" : "bg-risk-green/60",
                        )}
                        style={{ width: `${Math.min(100, score * 10)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-bone/10 pt-4">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-bone/20">
                <Check className="h-2.5 w-2.5 text-bone/60" strokeWidth={2} />
              </span>
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-bone/30">
                  Suggested fix
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-bone/60">{run.result.suggested_fix}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-5 font-mono text-[8px] uppercase tracking-[0.12em] text-bone/20">
            <span>
              {run.provider} · {run.model}
            </span>
            <span>
              {run.attempts} call{run.attempts === 1 ? "" : "s"} · {(run.latencyMs / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start gap-3 border border-risk-red/20 bg-risk-red/[0.035] p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-risk-red" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-risk-red/80">
                {STAGE_LABEL[run.error.stage] ?? run.error.stage}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-bone/60">{run.error.message}</p>
              {run.error.detail && (
                <p className="mt-3 break-words border-t border-bone/10 pt-3 font-mono text-[9px] leading-relaxed text-bone/35">
                  {run.error.detail}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.12em] text-bone/25">
            <span>{run.error.attempts} attempts</span>
            <span>{run.error.retryable ? "retryable" : "not retryable"}</span>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-bone/35">
            This critic is excluded from the risk denominator. Coverage fell accordingly — the score
            does not pretend the missing evidence exists.
          </p>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => onRetry(criticId)}
              disabled={retrying || retryDisabled}
              className="btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {retrying ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  Retrying this critic
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Retry this critic
                </>
              )}
            </button>
            <p className="mt-3 text-center font-mono text-[8px] uppercase tracking-[0.14em] text-bone/20">
              {run.provider} · {run.model}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
