"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  Braces,
  CheckCircle2,
  Clock3,
  Download,
  FileWarning,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wand2,
} from "lucide-react";
import { ConflictsPanel } from "@/components/conflicts-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CriticCard } from "@/components/critic-card";
import { DiffView } from "@/components/diff-view";
import { RiskMeter } from "@/components/risk-meter";
import { computeRisk } from "@/lib/aggregator";
import { createProviderCaller, createStreamProvider } from "@/lib/client";
import { detectFixConflicts, selectFixes } from "@/lib/conflicts";
import { estimateAnalysisCost, needsBudgetConfirmation, type CostEstimate } from "@/lib/cost";
import { getCritic } from "@/lib/critics";
import { getApiKey } from "@/lib/keyStore";
import { generateRewrite, retryCritic } from "@/lib/pipeline";
import { getProvider } from "@/lib/providers";
import type {
  AnalysisReport,
  AppSettings,
  CriticId,
  RewriteOutput,
} from "@/lib/types";
import { CRITIC_IDS } from "@/lib/types";
import { formatPercent, formatRelativeDate, partialJsonString } from "@/lib/utils";
interface ReportViewProps {
  report: AnalysisReport;
  settings: AppSettings;
  hasKey: boolean;
  onUpdate: (report: AnalysisReport) => void;
  demo?: boolean;
}

export function ReportView({ report, settings, hasKey, onUpdate, demo = false }: ReportViewProps) {
  const [resolutions, setResolutions] = useState<Record<string, CriticId | undefined>>({});
  const [retrying, setRetrying] = useState<CriticId | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewrite, setRewrite] = useState<RewriteOutput | null>(null);
  const [rewritePreview, setRewritePreview] = useState("");
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [pendingRewriteEstimate, setPendingRewriteEstimate] = useState<CostEstimate | null>(null);

  const successCount = CRITIC_IDS.filter((critic) => report.runs[critic]?.status === "success").length;
  const failureCount = CRITIC_IDS.length - successCount;
  const { fixes, unresolved } = useMemo(
    () => selectFixes(report.runs, report.conflicts, resolutions),
    [report.runs, report.conflicts, resolutions],
  );

  function updateRuns(runs: AnalysisReport["runs"]) {
    const risk = computeRisk(runs);
    const conflicts = detectFixConflicts(runs);
    onUpdate({ ...report, runs, risk, conflicts });
  }

  async function handleRetry(critic: CriticId) {
    if (demo) return;
    setRetryError(null);
    setRetrying(critic);
    try {
      const preset = getProvider(settings.providerId);
      const apiKey = preset.requiresKey ? await getApiKey(settings.providerId) : undefined;
      if (preset.requiresKey && !apiKey) {
        setRetryError("No API key is stored for this provider.");
        return;
      }
      const run = await retryCritic({
        critic,
        input: { content: report.content, personaId: report.personaId },
        settings,
        apiKey: apiKey ?? undefined,
        call: createProviderCaller(settings),
      });
      updateRuns({ ...report.runs, [critic]: run });
      setRetried(true);
      setRewrite(null);
      setResolutions({});
      if (run.status === "failure") {
        setRetryError(run.error.message);
      }
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "The retry failed.");
    } finally {
      setRetrying(null);
    }
  }

  function handleResolve(conflictId: string, critic: CriticId) {
    setResolutions((current) => ({ ...current, [conflictId]: critic }));
    setRewrite(null);
    setRewriteError(null);
  }

  async function handleRewrite(confirmed = false) {
    if (demo || fixes.length === 0 || unresolved.length > 0) return;
    const preset = getProvider(settings.providerId);
    if (preset.requiresKey && !hasKey) {
      setRewriteError("No API key is stored for this provider.");
      return;
    }

    if (!confirmed) {
      const estimate = estimateAnalysisCost(settings, report.content, 1);
      const guard = needsBudgetConfirmation(estimate, settings);
      if (guard.required) {
        setPendingRewriteEstimate(estimate);
        return;
      }
    }

    setPendingRewriteEstimate(null);
    setRewriting(true);
    setRewriteError(null);
    setRewritePreview("");
    try {
      const apiKey = preset.requiresKey ? await getApiKey(settings.providerId) : undefined;
      let streamedRaw = "";
      const result = await generateRewrite({
        content: report.content,
        personaId: report.personaId,
        fixes,
        settings,
        apiKey: apiKey ?? undefined,
        call: createProviderCaller(settings),
        stream: createStreamProvider(settings),
        onDelta: (delta) => {
          streamedRaw += delta;
          const readable = partialJsonString(streamedRaw, "rewritten_content");
          if (readable) setRewritePreview(readable);
        },
      });
      setRewrite(result);
      setRewritePreview("");
    } catch (error) {
      setRewriteError(error instanceof Error ? error.message : "The rewrite failed.");
    } finally {
      setRewriting(false);
    }
  }

  const evidenceCount = successCount;

  return (
    <section id="report" className="shell scroll-mt-24 pb-10">
      <div className="mb-7 flex flex-col justify-between gap-4 border-b border-bone/10 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">Pre-mortem report</span>
            {demo && (
              <span className="tag border-risk-amber/30 text-risk-amber/80">
                <FlaskConical className="h-2.5 w-2.5" strokeWidth={1.5} />
                sample data
              </span>
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone/30">
            {formatRelativeDate(report.createdAt)} · {report.personaLabel} · {report.provider.name} /{" "}
            {report.provider.model}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag">
            <Clock3 className="h-2.5 w-2.5" strokeWidth={1.5} />
            {(report.durationMs / 1000).toFixed(1)}s
          </span>
          <span className="tag">
            <Braces className="h-2.5 w-2.5" strokeWidth={1.5} />
            {successCount}/4 critics
          </span>
          <span className="tag">
            <ShieldAlert className="h-2.5 w-2.5" strokeWidth={1.5} />
            {report.provider.mode === "direct" ? "direct" : "proxy"}
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-bone/10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="bg-ink-950 p-6 sm:p-8">
          <RiskMeter risk={report.risk} />
        </div>

        <div className="bg-ink-950 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Executive readout</p>
            {report.summary.status === "success" ? (
              <span className="tag border-risk-green/20 text-risk-green/60">
                <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={1.5} />
                generated
              </span>
            ) : (
              <span className="tag border-risk-red/20 text-risk-red/70">unavailable</span>
            )}
          </div>

          {report.summary.status === "success" ? (
            <>
              <p className="mt-5 max-w-2xl text-pretty text-[17px] leading-[1.65] text-bone/75">
                {report.summary.summary}
              </p>

              <div className="mt-7">
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-bone/25">
                  Top failures, ranked
                </p>
                <div className="mt-3 divide-y divide-bone/[0.08]">
                  {report.summary.top_failures.map((failure, index) => (
                    <div key={`${failure.critic}-${index}`} className="flex gap-4 py-3.5">
                      <span className="mt-0.5 font-mono text-[9px] text-bone/20">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`#critic-${failure.critic}`}
                            className="font-mono text-[8px] uppercase tracking-[0.15em] text-bone/45 underline-offset-4 hover:text-bone/80 hover:underline"
                          >
                            {getCritic(failure.critic).shortName}
                          </a>
                          <ArrowDown className="h-2.5 w-2.5 text-bone/20" strokeWidth={1.5} />
                          <p className="text-[12px] leading-relaxed text-bone/65">{failure.scenario}</p>
                        </div>
                        <p className="mt-1 text-[10px] leading-relaxed text-bone/30">
                          {failure.why_it_matters}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 border border-risk-red/20 bg-risk-red/[0.03] p-4">
              <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-risk-red/80">
                <FileWarning className="h-3.5 w-3.5" strokeWidth={1.5} />
                Summary call failed
              </p>
              <p className="mt-2 text-xs leading-relaxed text-bone/45">{report.summary.error}</p>
              <p className="mt-3 text-[10px] leading-relaxed text-bone/30">
                The deterministic risk score and critic cards below are still valid. Only the
                narrative readout is missing.
              </p>
            </div>
          )}

          {retried && (
            <p className="mt-5 border-t border-bone/10 pt-3 text-[10px] leading-relaxed text-bone/30">
              A critic was retried. Risk and conflicts were recalculated; the executive readout still
              describes the original pass.
            </p>
          )}
        </div>
      </div>

      <div className="mt-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3">
            <p className="eyebrow">The critics</p>
            <span className="h-px w-8 bg-bone/20" />
            <span className="font-mono text-[9px] text-bone/25">{evidenceCount} grounded reads</span>
          </div>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-bone sm:text-4xl">
            Four ways this dies.
          </h2>
        </div>
        {failureCount > 0 && (
          <p className="max-w-sm text-[10px] leading-relaxed text-bone/30">
            {failureCount} critic{failureCount === 1 ? "" : "s"} failed. The score excludes them and
            coverage is reduced. Retry each card independently.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-px bg-bone/10 md:grid-cols-2">
        {CRITIC_IDS.map((criticId, index) => {
          const run = report.runs[criticId];
          if (!run) return null;
          return (
            <div id={`critic-${criticId}`} key={criticId} className="scroll-mt-24 bg-ink-950">
              <CriticCard
                criticId={criticId}
                index={index}
                run={run}
                onRetry={handleRetry}
                retrying={retrying === criticId}
                retryDisabled={demo || Boolean(retrying)}
              />
            </div>
          );
        })}
      </div>

      {retryError && (
        <div role="alert" className="mt-4 flex items-start gap-3 border border-risk-red/25 bg-risk-red/[0.04] px-4 py-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-risk-red" strokeWidth={1.5} />
          <p className="text-xs leading-relaxed text-bone/60">{retryError}</p>
        </div>
      )}

      <div className="mt-12">
        <div className="mb-4 flex items-center gap-3">
          <p className="eyebrow">Prioritization</p>
          <span className="h-px w-8 bg-bone/20" />
          <span className="font-mono text-[9px] text-bone/25">
            {fixes.length} fix{fixes.length === 1 ? "" : "es"} selected
          </span>
        </div>
        <ConflictsPanel conflicts={report.conflicts} resolutions={resolutions} onResolve={handleResolve} />
      </div>

      <section className="panel mt-8 overflow-hidden" aria-labelledby="rewrite-title">
        <div className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-bone/15">
              <Wand2 className="h-4 w-4 text-bone/55" strokeWidth={1.5} />
            </span>
            <div>
              <h2 id="rewrite-title" className="text-lg font-normal tracking-tight text-bone">
                Draft the prioritized rewrite
              </h2>
              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-bone/40">
                Only the fixes above enter the prompt. Each change is attributed to its source critic
                in a before/after diff. Unselected contradictions stay out.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fixes.map((fix) => (
                  <span key={`${fix.critic}-${fix.fix.slice(0, 12)}`} className="tag">
                    {getCritic(fix.critic).shortName}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => void handleRewrite()}
              disabled={rewriting || unresolved.length > 0 || fixes.length === 0 || demo}
              className="btn-primary whitespace-nowrap disabled:cursor-not-allowed"
            >
              {rewriting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  Rewriting
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {rewrite ? "Rewrite again" : "Generate rewrite"}
                </>
              )}
            </button>
            {demo ? (
              <p className="max-w-[220px] text-right font-mono text-[8px] uppercase leading-relaxed tracking-[0.12em] text-bone/25">
                Sample report. Run your own analysis to generate a rewrite.
              </p>
            ) : unresolved.length > 0 ? (
              <p className="max-w-[220px] text-right font-mono text-[8px] uppercase leading-relaxed tracking-[0.12em] text-risk-amber/60">
                Resolve {unresolved.length} conflict{unresolved.length === 1 ? "" : "s"} first
              </p>
            ) : (
              <p className="max-w-[220px] text-right font-mono text-[8px] uppercase leading-relaxed tracking-[0.12em] text-bone/20">
                Selected fixes only · one call
              </p>
            )}
          </div>
        </div>

        {rewriting && (
          <div className="border-t border-bone/10 p-5 sm:p-6" aria-live="polite">
            {rewritePreview ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-risk-amber" />
                  <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-bone/35">
                    Streaming rewrite
                  </p>
                </div>
                <div className="mt-3 max-h-[360px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-[1.8] text-bone/60">
                  {rewritePreview}
                  <span className="ml-0.5 inline-block h-3 w-1 animate-pulse-soft bg-bone/60 align-middle" />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-5/6" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            )}
            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-bone/25">
              Editing with the selected constraints…
            </p>
          </div>
        )}

        {rewriteError && (
          <div role="alert" className="border-t border-bone/10 p-5 sm:p-6">
            <div className="flex items-start gap-3 border border-risk-red/25 bg-risk-red/[0.04] px-4 py-3.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-risk-red" strokeWidth={1.5} />
              <div>
                <p className="text-xs leading-relaxed text-bone/60">{rewriteError}</p>
                <button
                  type="button"
                  onClick={() => void handleRewrite()}
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-bone/45 underline-offset-4 hover:text-bone hover:underline"
                >
                  <RefreshCw className="h-2.5 w-2.5" strokeWidth={1.5} />
                  Retry rewrite
                </button>
              </div>
            </div>
          </div>
        )}

        {rewrite && (
          <div className="border-t border-bone/10">
            <DiffView
              before={report.content}
              after={rewrite.rewritten_content}
              changes={rewrite.changes}
              notes={rewrite.notes}
            />
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-col justify-between gap-3 border-t border-bone/10 pt-5 sm:flex-row sm:items-center">
        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-bone/20">
          Report {report.id.slice(0, 8)} · hash {report.contentHash.slice(0, 12)}… ·{" "}
          {formatPercent(report.risk.coverage, 0)} weight coverage
        </p>
        {demo && (
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-bone/45 transition-colors hover:text-bone"
          >
            <Download className="h-3 w-3" strokeWidth={1.5} />
            Start a real analysis
          </Link>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingRewriteEstimate)}
        title="Budget guard · rewrite"
        description={
          pendingRewriteEstimate
            ? `One rewrite call on ${pendingRewriteEstimate.modelLabel}. Estimated cost: $${pendingRewriteEstimate.estimatedUsd.toFixed(3)}. Your ceiling is $${settings.budgetCeilingUsd.toFixed(2)}.`
            : ""
        }
        confirmLabel="Rewrite anyway"
        onCancel={() => setPendingRewriteEstimate(null)}
        onConfirm={() => void handleRewrite(true)}
      />
    </section>
  );
}
