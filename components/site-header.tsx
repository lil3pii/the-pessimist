"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { DEFAULT_SETTINGS, loadSettings, modeLabel } from "@/lib/settingsStore";
import type { AppSettings } from "@/lib/types";

export function SiteHeader() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-bone/[0.07] bg-ink-950/80 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-3" aria-label="The Pessimist home">
          <span className="relative flex h-7 w-7 items-center justify-center border border-bone/25 transition-colors group-hover:border-bone/50">
            <span className="block h-2.5 w-2.5 rotate-45 border border-bone/70 transition-transform duration-500 group-hover:rotate-[135deg]" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-bone">
              The Pessimist
            </span>
            <span className="mt-1 hidden font-mono text-[8px] uppercase tracking-[0.2em] text-bone/30 sm:block">
              Pre-mortem content analysis
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/settings"
            className="hidden items-center gap-2 border border-bone/10 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-bone/55 transition-colors hover:border-bone/25 hover:text-bone sm:inline-flex"
            title="Current routing mode"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${settings.mode === "direct" ? "bg-risk-green" : "bg-risk-amber"}`}
            />
            {modeLabel(settings.mode)}
          </Link>

          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={`inline-flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
              pathname === "/settings" ? "text-bone" : "text-bone/50 hover:text-bone"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Settings</span>
          </Link>

          <span
            className="inline-flex items-center border border-bone/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-bone/50"
            title="Bring your own key. No server-side key storage."
          >
            BYOK
          </span>
        </div>
      </div>
    </header>
  );
}
