"use client";

import { AlertOctagon, GitMerge, Check } from "lucide-react";
import { getCritic } from "@/lib/critics";
import type { CriticId, FixConflict } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConflictsPanelProps {
  conflicts: FixConflict[];
  resolutions: Record<string, CriticId | undefined>;
  onResolve: (conflictId: string, critic: CriticId) => void;
}

export function ConflictsPanel({ conflicts, resolutions, onResolve }: ConflictsPanelProps) {
  if (conflicts.length === 0) {
    return (
      <div className="panel flex items-start gap-4 p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-risk-green/25">
          <GitMerge className="h-3.5 w-3.5 text-risk-green/70" strokeWidth={1.5} />
        </span>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-bone/55">
            No conflicting fixes
          </p>
          <p className="mt-2 text-xs leading-relaxed text-bone/40">
            All successful critics agree on direction. Every suggested fix will be passed to the
            rewrite, each labelled with its source critic.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="conflicts-title" className="panel overflow-hidden">
      <div className="flex items-start gap-4 border-b border-bone/10 px-5 py-5 sm:px-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-risk-amber/30">
          <AlertOctagon className="h-4 w-4 text-risk-amber" strokeWidth={1.5} />
        </span>
        <div>
          <h2 id="conflicts-title" className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone/80">
            Fix conflict · choose a direction
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-bone/40">
            Two critics want opposite changes in the same dimension. The rewrite receives only the
            option you select here. It will not silently blend contradictions.
          </p>
        </div>
      </div>

      <div className="divide-y divide-bone/[0.08]">
        {conflicts.map((conflict) => {
          const selected = resolutions[conflict.id];
          return (
            <div key={conflict.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-bone/75">{conflict.title}</p>
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-bone/25">
                  {selected ? "resolved" : "requires a choice"}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-bone/35">{conflict.explanation}</p>

              <div className="mt-4 grid gap-2.5 md:grid-cols-2" role="radiogroup" aria-label={conflict.title}>
                {conflict.options.map((option) => {
                  const critic = getCritic(option.critic);
                  const active = selected === option.critic;
                  return (
                    <button
                      key={option.critic}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onResolve(conflict.id, option.critic)}
                      className={cn(
                        "group relative border p-4 text-left transition-all duration-200",
                        active
                          ? "border-bone/40 bg-bone/[0.045]"
                          : "border-bone/10 hover:border-bone/25 hover:bg-bone/[0.02]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone/55">
                          {critic.shortName}
                        </span>
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full border",
                            active ? "border-bone bg-bone text-ink-950" : "border-bone/25",
                          )}
                        >
                          {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                        </span>
                      </div>
                      <p className="mt-2.5 text-[11px] leading-relaxed text-bone/50">{option.fix}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
