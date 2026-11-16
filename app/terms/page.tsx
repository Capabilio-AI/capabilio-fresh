import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_SUMMARY, TERMS_UPDATED } from "@/lib/legal/terms";

export const metadata: Metadata = { title: "Terms of Service — Capabilio AI", description: "The binding rules for using Capabilio AI as a student, graduate, professional, college or company." };

export default function TermsPage() {
  return <LegalPage title="Terms of Service" updated={TERMS_UPDATED} intro={TERMS_INTRO} summary={TERMS_SUMMARY} sections={TERMS_SECTIONS} />;
}
