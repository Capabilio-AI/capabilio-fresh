import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_SUMMARY, PRIVACY_UPDATED } from "@/lib/legal/privacy";

export const metadata: Metadata = { title: "Privacy Policy — Capabilio AI", description: "What Capabilio AI collects, why, who sees it, how long we keep it, and your rights under the DPDP Act." };

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated={PRIVACY_UPDATED} intro={PRIVACY_INTRO} summary={PRIVACY_SUMMARY} sections={PRIVACY_SECTIONS} />;
}
