import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-bone/[0.07]">
      <div className="shell flex flex-col justify-between gap-6 py-8 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <span className="mt-1 block h-2 w-2 rotate-45 border border-bone/40" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/60">
              Assume it fails. Then fix it.
            </p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-bone/35">
              The score is deterministic and reproducible. The critics are independent. The evidence
              must exist in your text.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[0.16em] text-bone/35">
          <Link href="/settings" className="transition-colors hover:text-bone/70">
            Settings
          </Link>
          <Link href="/demo" className="transition-colors hover:text-bone/70">
            Sample report
          </Link>
          <span>BYOK</span>
          <span>v1.0</span>
        </div>
      </div>
    </footer>
  );
}
