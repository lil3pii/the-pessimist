import type { Metadata } from "next";
import { DemoReport } from "@/components/demo-report";

export const metadata: Metadata = {
  title: "Sample pre-mortem — The Pessimist",
  description: "A complete sample report with grounded critic evidence and a deterministic risk score.",
};

export default function DemoPage() {
  return <DemoReport />;
}
