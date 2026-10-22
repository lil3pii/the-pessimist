"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock3,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  Square,
} from "lucide-react";
import { ReportView } from "@/components/report-view";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { estimateAnalysisCost, needsBudgetConfirmation, type CostEstimate } from "@/lib/cost";
import { getApiKey } from "@/lib/keyStore";
import { getCachedCritic, setCachedCritic } from "@/lib/cache";
import { runAnalysis } from "@/lib/pipeline";
import { createProviderCaller, createStreamProvider } from "@/lib/client";
import { getProvider, capabilityLabel } from "@/lib/providers";
import { DEFAULT_SETTINGS, directModeAllowed, loadSettings, modeLabel } from "@/lib/settingsStore";
import { SAMPLE_CONTENT, getSampleReport } from "@/lib/sample";
import { CRITICS } from "@/lib/critics";
import type { AnalysisReport, AppSettings, PersonaId } from "@/lib/types";
import { PERSONAS } from "@/lib/types";
import { cn, formatUsd, partialJsonString } from "@/lib/utils";

const MAX_CONTENT = 30_000;
const MIN_CONTENT = 40;

export function Workspace() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [content, setContent] = useState("");
  const [personaId, setPersonaId] = useState<PersonaId>("time-poor-executive");
  const [hasKey, setHasKey] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryPreview, setSummaryPreview] = useState("");
  const [pendingEstimate, setPendingEstimate] = useState<CostEstimate | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const preset = getProvider(settings.providerId);
  const analysisEstimate = useMemo(() => estimateAnalysisCost(settings, content), [settings, content]);
  const valid = content.trim().length >= MIN_CONTENT && content.length <= MAX_CONTENT;
  const canDirect = directModeAllowed(settings);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    const provider = getProvider(loaded.providerId);
    if (!provider.requiresKey) {
      setHasKey(true);
    } else {
      void getApiKey(loaded.providerId).then((key) => setHasKey(Boolean(key)));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!analyzing) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [analyzing]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function fillSample() {
    setContent(SAMPLE_CONTENT);
    setPersonaId("time-poor-executive");
    setError(null);
    requestAnimationFrame(() => {
      document.getElementById("content-input")?.focus();
    });
  }

  function openSampleReport() {
    setReport(getSampleReport());
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function executeAnalysis() {
    setPendingEstimate(null);
    setError(null);
    setReport(null);
    setElapsed(0);
    setSummaryPreview("");
    setAnalyzing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiKey = preset.requiresKey ? await getApiKey(settings.providerId) : undefined;
      if (preset.requiresKey && !apiKey) {
        setError("No API key is stored for this provider. Add one in Settings before running.");
        return;
      }
      if (settings.mode === "direct" && !canDirect) {
        setError("Direct Mode is not allowed for this provider. Switch to Stateless Proxy or enable the advanced opt-in.");
        return;
      
      }

      let summaryRaw = "";
      const nextReport = await runAnalysis({
        input: { content, personaId },
        settings,
        apiKey: apiKey ?? undefined,
        call: createProviderCaller(settings),
        cache: { get: getCachedCritic, set: setCachedCritic },
        signal: controller.signal,
        stream: createStreamProvider(settings),
        onSummaryDelta: (_delta) => {
          summaryRaw += _delta;
          const readable = partialJsonString(summaryRaw, "summary");
          if (readable) setSummaryPreview(readable);
        },
      });
      setReport(nextReport);
      setSummaryPreview("");
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The analysis failed unexpectedly.");
      setSummaryPreview("");
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  }

  function startAnalysis() {
    if (!valid) {
      setError(`Paste at least ${MIN_CONTENT} characters of content (maximum ${MAX_CONTENT.toLocaleString()}).`);
      return;
    }
    if (preset.requiresKey && !hasKey) {
      setError("No API key is stored for this provider. Add one in Settings before running.");
      return;
    }
    if (settings.mode === "direct" && !canDirect) {
      setError("Direct Mode is disabled for this provider. Open Settings and switch to Stateless Proxy.");
      return;
    
    }
    const budget = needsBudgetConfirmation(analysisEstimate, settings);
    if (budget.required) {
      setPendingEstimate(analysisEstimate);
      setError(budget.reason ?? null);
      return;
    }
    void executeAnalysis();
  }

  function cancelAnalysis() {
    abortRef.current?.abort(new DOMException("Cancelled by user.", "AbortError"));
    setAnalyzing(false);
    setError("Analysis cancelled.");
  }

  const providerName = preset.name;
  const charPercent = Math.min(100, (content.length / MAX_CONTENT) * 100);

  return (
    <>
      <section className="shell relative pb-14 pt-12 sm:pt-16 lg:pb-20 lg:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
          <div className="animate-fade-up">
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <span className="eyebrow">Pre-mortem / No. 001</span>
              <span className="h-px w-8 bg-bone/20" />
              <span className="eyebrow text-bone/25">Before you publish</span>
            </div>

            <h1 className="display max-w-4xl text-[clamp(3.6rem,9vw,8.5rem)] text-bone">
              Assume it
              <br />
              <span className="editorial-italic font-normal text-bone/85">fails.</span>
            </h1>

            <p className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-bone/55 sm:text-lg">
              Four independent critics try to kill your content. They cite the exact sentence that
              creates the risk. Then a deterministic score — not a model&apos;s opinion — tells you
              what to repair first.
            </p>

            <div className="mt-11 border border-bone/10 bg-ink-900/50">
              <div className="flex flex-col gap-4 border-b border-bone/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center border border-bone/15">
                    <span className="h-1.5 w-1.5 rounded-full bg-risk-amber" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone/35">
                      Reader persona
                    </p>
                    <p className="mt-0.5 text-sm text-bone/80">
                      {PERSONAS.find((entry) => entry.id === personaId)?.label}
                    </p>
                  </div>
                </div>
                <label className="sr-only" htmlFor="persona">
                  Reader persona
                </label>
                <select
                  id="persona"
                  value={personaId}
                  onChange={(event) => setPersonaId(event.target.value as PersonaId)}
                  className="w-full border border-bone/10 bg-ink-950 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone/65 focus:border-bone/35 sm:w-auto"
                  disabled={analyzing}
                >
                  {PERSONAS.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label htmlFor="content-input" className="sr-only">
                  Content to analyze
                </label>
                <textarea
                  id="content-input"
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value.slice(0, MAX_CONTENT));
                    if (error) setError(null);
                  }}
                  placeholder="Paste the draft. The launch post, the landing page, the email. No summaries — the critics need the actual words."
                  className="min-h-[calc(100svh-17rem)] w-full resize-y bg-transparent px-5 py-5 font-sans text-[15px] leading-[1.8] text-bone placeholder:text-bone/22 focus:outline-none sm:min-h-[320px] lg:min-h-[360px]"
                  spellCheck
                  disabled={analyzing}
                  aria-describedby="content-meta"
                />
              </div>

              <div
                id="content-meta"
                className="flex flex-col gap-3 border-t border-bone/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-bone/35">
                    {content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
                  </p>
                  <div className="h-0.5 w-24 overflow-hidden bg-bone/10">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        charPercent > 95 ? "bg-risk-amber" : "bg-bone/50",
                      )}
                      style={{ width: `${charPercent}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tag">{providerName}</span>
                  <span className="tag">{modeLabel(settings.mode)}</span>
                </div>
              </div>
            </div>

            <div className="mobile-sticky-cta mt-3 flex items-center justify-between gap-4">
              <p className="hidden max-w-xs text-[11px] leading-relaxed text-bone/30 sm:block">
                Evidence must be an exact substring. Hallucinated quotes are rejected before they
                reach this screen.
              </p>
              <button
                type="button"
                onClick={analyzing ? cancelAnalysis : startAnalysis}
                disabled={!valid && !analyzing}
                className={cn(
                  "group ml-auto inline-flex w-full items-center justify-center gap-3 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.18em] transition-all sm:w-auto",
                  analyzing
                    ? "border border-bone/20 text-bone/70 hover:border-bone/40 hover:text-bone"
                    : "bg-bone text-ink-950 hover:-translate-y-0.5 hover:bg-white disabled:translate-y-0 disabled:opacity-30",
                )}
              >
                {analyzing ? (
                  <>
                    <Square className="h-3 w-3" strokeWidth={2} />
                    Cancel · {elapsed}s
                  </>
                ) : (
                  <>
                    Run pre-mortem
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2} />
                  </>
                )}
              </button>
            </div>

            {!hasKey && preset.requiresKey && hydrated && (
              <div className="mt-4 flex flex-col gap-3 border border-risk-amber/25 bg-risk-amber/[0.04] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-risk-amber" strokeWidth={1.5} />
                  <p className="text-xs leading-relaxed text-bone/60">
                    No key stored for {providerName}. Add one to run the critics.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-risk-amber underline-offset-4 hover:underline"
                >
                  Open settings →
                </Link>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-3 border border-risk-red/25 bg-risk-red/[0.04] px-4 py-3.5"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-risk-red" strokeWidth={1.5} />
                <p className="text-xs leading-relaxed text-bone/65">{error}</p>
              </div>
            )}

            {!report && !analyzing && (
              <div className="mt-10 border border-dashed border-bone/12 p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div className="min-w-0 max-w-lg">
                    <p className="eyebrow text-bone/30">The empty state is the product</p>
                    <div className="mt-4 border border-bone/10 bg-black/25 p-4">
                      <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-bone/25">
                        Sample draft · Northstar launch page
                      </p>
                      <p className="mt-2 line-clamp-4 text-[12px] leading-relaxed text-bone/45">
                        {SAMPLE_CONTENT}
                      </p>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-bone/30">
                      Load it to run your own key, or open the keyless report with a 0.76 risk score,
                      four grounded critics, and a real conflict.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
                    <button type="button" onClick={fillSample} className="btn-primary whitespace-nowrap">
                      Try with sample
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={openSampleReport}
                      className="btn-ghost whitespace-nowrap"
                    >
                      View sample report
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-8 lg:sticky lg:top-28">
            <div className="border-t border-bone/15 pt-5">
              <p className="eyebrow">The method</p>
              <ol className="mt-6 space-y-5">
                {[
                  ["01", "Four critics run in parallel. One failure does not hide the others."],
                  ["02", "Every claim needs a quote. A substring check rejects invented evidence."],
                  ["03", "The score is arithmetic, not a model output. Reproducible and auditable."],
                  ["04", "Conflicts are exposed. You decide which fix survives the rewrite."],
                ].map(([number, text]) => (
                  <li key={number} className="flex gap-4">
                    <span className="mt-0.5 font-mono text-[9px] text-bone/25">{number}</span>
                    <span className="text-xs leading-relaxed text-bone/50">{text}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">Active engine</p>
                <span className="tag">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      settings.mode === "direct" ? "bg-risk-green" : "bg-risk-amber",
                    )}
                  />
                  {modeLabel(settings.mode)}
                </span>
              </div>
              <p className="mt-4 text-lg tracking-tight text-bone/90">{providerName}</p>
              <p className="mt-1 break-all font-mono text-[10px] text-bone/40">{settings.model}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="tag">{capabilityLabel(preset.jsonMode)}</span>
                <span className="tag">{settings.supportsJsonMode ? "JSON on" : "Prompt JSON"}</span>
              </div>
              <Link
                href="/settings"
                className="mt-5 flex items-center justify-between border-t border-bone/10 pt-4 font-mono text-[9px] uppercase tracking-[0.15em] text-bone/45 transition-colors hover:text-bone"
              >
                Change provider
                <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
              </Link>
            </div>

            <div className="border border-bone/10 p-5">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-bone/35" strokeWidth={1.4} />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone/45">
                    Key handling
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-bone/40">
                    {settings.mode === "proxy"
                      ? "Your key is sent to our stateless proxy for each request. We do not log or store it. If your threat model requires the key to never leave your device, use Direct Mode."
                      : "In Direct Mode the key stays in this browser and calls the provider directly. Your provider sees the request from your origin. Not all providers allow browser CORS."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 px-1">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bone/25" strokeWidth={1.4} />
              <p className="text-[10px] leading-relaxed text-bone/30">
                30s per call · 120s pipeline · 24h critic cache
                {analysisEstimate.priced ? ` · est. ${formatUsd(analysisEstimate.estimatedUsd)} per run` : ""}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <div ref={resultsRef} />

      {analyzing && <AnalysisProgress elapsed={elapsed} summaryPreview={summaryPreview} />}

      {report && (
        <ReportView
          key={report.id}
          report={report}
          settings={settings}
          hasKey={hasKey}
          onUpdate={setReport}
          demo={report.id === "sample-report"}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingEstimate)}
        title="Budget guard"
        description={
          pendingEstimate
            ? `${analysisEstimate.modelLabel} · ${analysisEstimate.inputTokens.toLocaleString()} input tokens · ${analysisEstimate.outputTokens.toLocaleString()} output tokens. Estimated analysis cost: ${formatUsd(pendingEstimate.estimatedUsd)}. Your ceiling is ${formatUsd(settings.budgetCeilingUsd)}.`
            : ""
        }
        confirmLabel="Run anyway"
        onCancel={() => {
          setPendingEstimate(null);
          setError(null);
        }}
        onConfirm={() => void executeAnalysis()}
      />
    </>
  );
}

function AnalysisProgress({ elapsed, summaryPreview }: { elapsed: number; summaryPreview: string }) {
  const progress = Math.min(96, Math.round((elapsed / 45) * 100));
  return (
    <section className="shell pb-10" id="analysis-progress" aria-live="polite">
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-bone/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-bone/60" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone/70">
                Running the pre-mortem
              </p>
              <p className="mt-1 text-[11px] text-bone/35">
                Critics run in parallel. The summary follows the evidence.
              </p>
            </div>
          </div>
          <p className="font-mono text-[10px] tabular-nums text-bone/35">
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")} / 02:00
          </p>
        </div>
        <div className="grid gap-px bg-bone/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {CRITICS.map((critic, index) => (
            <div key={critic.id} className="bg-ink-950 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-bone/35">
                  0{index + 1} · {critic.shortName}
                </span>
                <Loader2 className="h-3 w-3 animate-spin text-bone/25" strokeWidth={1.5} />
              </div>
              <div className="mt-4 h-1 w-full overflow-hidden bg-bone/10">
                <div className="h-full w-1/3 animate-scan bg-bone/40" />
              </div>
            </div>
          ))}
        </div>
        {summaryPreview && (
          <div className="border-t border-bone/10 px-5 py-5" aria-live="polite">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-risk-amber" />
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-bone/35">
                Streaming executive readout
              </p>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-bone/60">
              {summaryPreview}
              <span className="ml-0.5 inline-block h-3 w-1 animate-pulse-soft bg-bone/60 align-middle" />
            </p>
          </div>
        )}
        <div className="h-0.5 bg-bone/10">
          <div className="h-full bg-bone/50 transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
