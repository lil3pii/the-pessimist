import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Pessimist — Pre-mortem content analysis",
  description:
    "Four independent critics predict how your content fails before you publish. Deterministic risk score, grounded evidence, prioritized rewrite.",
  applicationName: "The Pessimist",
  authors: [{ name: "The Pessimist" }],
  openGraph: {
    title: "The Pessimist — Assume it fails.",
    description:
      "A pre-mortem for content. Four independent critics, deterministic risk, prioritized rewrite.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-ink-950 font-sans antialiased">
        <div className="grain-overlay" aria-hidden="true" />
        <SiteHeader />
        <main className="relative">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
