import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = {
  title: "Settings — The Pessimist",
  description: "Bring your own key, choose a provider and routing mode, and configure JSON capability.",
};

export default function SettingsPage() {
  return <SettingsForm />;
}
