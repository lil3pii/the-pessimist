import { riskColor, riskVar } from "@/lib/aggregator";
import type { RiskReport } from "@/lib/types";
import { getCritic } from "@/lib/critics";
import { cn, formatPercent } from "@/lib/utils";

export function RiskMeter({ risk }: { risk: RiskReport }) {
  const score = risk.score;
  const color = risk.level === "red" ? "red" : risk.level === "amber" ? "amber" : "green";
  const label = score === null ? "Incomplete" : risk.level === "red" ? "High risk" : risk.level === "amber" ? "Moderate risk" : "Low risk";
  const percent = score === null ? 0 : Math.round(score * 100);

  return (
    <div className="h-full">
      <div className="flex items-start justify-between gap-4">
        <p className="eyebrow">Overall risk</p>
        <span className="tag">
          Coverage {formatPercent(risk.coverage, 0)}
        </span>
      </div>

      <div className="mt-5 flex items-end gap-4">
        <span
          className={cn("display tabular-nums", riskColor(risk.level))}
          style={{ fontSize: "clamp(4.5rem, 8vw, 7rem)" }}
        >
          {score === null ? "—" : score.toFixed(2)}
        </span>
        <div className="mb-3 flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone/70">{label}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone/30">
            deterministic score
          </span>
        </div>
      </div>

      <div className="mt-6">
        <div className="risk-rule">
          <span style={{ width: `${percent}%`, background: riskVar(risk.level) }} />
        </div>
        <div className="relative mt-2 h-3 font-mono text-[8px] uppercase tracking-[0.16em] text-bone/25">
          <span className="absolute left-0">0.00</span>
          <span className={cn("absolute left-[40%] -translate-x-1/2", color === "green" && "text-risk-green/70")}>
            0.40
          </span>
          <span className={cn("absolute left-[70%] -translate-x-1/2", color === "amber" && "text-risk-amber/70")}>
            0.70
          </span>
          <span className="absolute right-0">1.00</span>
        </div>
      </div>

      <div className="mt-7 space-y-2.5">
        {risk.contributions.map((contribution) => {
          const critic = getCritic(contribution.critic);
          return (
            <div key={contribution.critic} className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "h-1 w-1 shrink-0 rounded-full",
                    contribution.counted ? "bg-bone/50" : "bg-bone/15",
                  )}
                />
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.13em] text-bone/40">
                  {critic.shortName}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[9px] tabular-nums text-bone/30">
                {contribution.counted && contribution.probability !== null ? (
                  <>
                    {contribution.weight.toFixed(2)} × {contribution.probability.toFixed(2)} ={" "}
                    <span className="text-bone/55">{(contribution.weighted ?? 0).toFixed(2)}</span>
                  </>
                ) : (
                  "excluded"
                )}
              </span>
            </div>
          );
        })}
      </div>

      <details className="group mt-6 border-t border-bone/10 pt-3">
        <summary className="cursor-pointer list-none font-mono text-[8px] uppercase tracking-[0.16em] text-bone/25 transition-colors hover:text-bone/50">
          How this number is made
        </summary>
        <p className="mt-3 text-[10px] leading-relaxed text-bone/35">
          Σ(weight × critic probability) ÷ Σ(weights). No LLM touches the arithmetic. Failed critics
          are excluded from both sums and reduce coverage.
        </p>
      </details>
    </div>
  );
}
