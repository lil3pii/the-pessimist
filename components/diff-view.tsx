"use client";

import { Check, Copy, FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import { getCritic } from "@/lib/critics";
import type { RewriteChange } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DiffViewProps {
  before: string;
  after: string;
  changes: RewriteChange[];
  notes: string;
}

export function DiffView({ before, after, changes, notes }: DiffViewProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"split" | "changes">("split");

  async function copyRewrite() {
    try {
      await navigator.clipboard.writeText(after);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bone/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-bone/35" strokeWidth={1.5} />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone/50">
            Prioritized rewrite
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView("split")}
            className={cn(
              "px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] transition-colors",
              view === "split" ? "bg-bone/10 text-bone/80" : "text-bone/30 hover:text-bone/60",
            )}
          >
            Before / after
          </button>
          <button
            type="button"
            onClick={() => setView("changes")}
            className={cn(
              "px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] transition-colors",
              view === "changes" ? "bg-bone/10 text-bone/80" : "text-bone/30 hover:text-bone/60",
            )}
          >
            Changes · {changes.length}
          </button>
          <button
            type="button"
            onClick={() => void copyRewrite()}
            className="ml-2 inline-flex items-center gap-1.5 border border-bone/15 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-bone/55 transition-colors hover:border-bone/35 hover:text-bone"
          >
            {copied ? <Check className="h-2.5 w-2.5" strokeWidth={2} /> : <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {view === "split" ? (
        <div className="grid divide-y divide-bone/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-risk-red/60" />
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-bone/35">Before</p>
            </div>
            <div className="max-h-[520px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-[1.8] text-bone/45">
              {before}
            </div>
          </div>
          <div className="relative p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bone/[0.02] to-transparent" />
            <div className="relative mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-risk-green/60" />
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-bone/55">After</p>
            </div>
            <div className="relative max-h-[520px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-[1.8] text-bone/75">
              {after}
            </div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-bone/[0.08]">
          {changes.map((change, index) => (
            <div key={`${change.critic}-${index}`} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tag">
                  {change.critic === "editorial" ? "Editorial" : getCritic(change.critic).shortName}
                </span>
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-bone/20">
                  Change {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="border-l border-risk-red/35 bg-risk-red/[0.025] p-3">
                  <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-risk-red/50">Before</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-bone/40 line-through decoration-bone/20">
                    {change.before || "—"}
                  </p>
                </div>
                <div className="border-l border-risk-green/35 bg-risk-green/[0.025] p-3">
                  <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-risk-green/50">After</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-bone/70">{change.after || "—"}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-bone/35">{change.rationale}</p>
            </div>
          ))}
        </div>
      )}

      {notes && (
        <div className="flex items-start gap-2.5 border-t border-bone/10 bg-bone/[0.02] px-5 py-4 text-[10px] leading-relaxed text-bone/35 sm:px-6">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-bone/30" strokeWidth={1.5} />
          <span>
            <span className="font-mono uppercase tracking-[0.12em] text-bone/45">Editor&apos;s note: </span>
            {notes}
          </span>
        </div>
      )}
    </div>
  );
}
