"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export const BANNER_COPY = "Without completing your assessment, Capabilio cannot generate a personalised roadmap or career path for you. Take the assessment to create your profile.";

/** Persistent until PROFILE_READY. The server decides whether it renders at all; this only reports that it was seen. */
export function AssessmentBanner({ cta }: { cta: "Start Assessment" | "Continue Assessment" }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("assess-banner-seen")) return;
      sessionStorage.setItem("assess-banner-seen", "1");
    } catch { /* storage blocked: still report once per mount */ }
    void fetch("/api/assess/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "assessment_banner_shown" }) }).catch(() => {});
  }, []);

  return (
    <aside role="region" aria-label="Assessment required" className="glass relative mb-4 flex flex-col gap-3 overflow-hidden rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <span aria-hidden className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-[var(--m-accent)] opacity-20 blur-3xl" />
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--m-accent)] text-white shadow-[0_8px_18px_-8px_var(--m-accent)]"><Sparkles className="h-5 w-5" aria-hidden /></span>
      <p className="relative min-w-0 flex-1 text-[14px] font-bold leading-snug text-[var(--m-ink)]">{BANNER_COPY}</p>
      <Link href="/assessment" className="relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_20px_-10px_rgb(20_20_20/0.7)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]">
        {cta} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </aside>
  );
}
