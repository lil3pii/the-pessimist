"use client";

import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { useState } from "react";
import { ReportView } from "@/components/report-view";
import { getSampleReport } from "@/lib/sample";
import { DEFAULT_SETTINGS } from "@/lib/settingsStore";
import type { AnalysisReport } from "@/lib/types";

export function DemoReport() {
  const [report, setReport] = useState<AnalysisReport>(() => getSampleReport());

  return (
    <>
      <section className="shell pb-8 pt-12 sm:pt-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-bone/40 transition-colors hover:text-bone"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
          Back to the analysis
        </Link>
        <div className="mt-8 flex flex-col justify-between gap-6 border-b border-bone/10 pb-8 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <FlaskConical className="h-4 w-4 text-risk-amber" strokeWidth={1.5} />
              <span className="eyebrow">Sample dossier</span>
            </div>
            <h1 className="display mt-5 max-w-4xl text-[clamp(2.7rem,6vw,5.5rem)] text-bone">
              A page that
              <br />
              <span className="editorial-italic font-normal text-bone/80">looks fine.</span>
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-bone/40">
            This is a fixed demonstration of the report format: deterministic score, grounded critic
            evidence, and a real conflict between two suggested fixes. No API key was used.
          </p>
        </div>
      </section>
      <ReportView
        report={report}
        settings={DEFAULT_SETTINGS}
        hasKey={false}
        onUpdate={setReport}
        demo
      />
    </>
  );
}
