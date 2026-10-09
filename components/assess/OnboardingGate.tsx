import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { OnboardingStatus } from "@/lib/assess/config";

const STEPS: { at: OnboardingStatus[]; label: string }[] = [
  { at: ["ASSESSMENT_REQUIRED"], label: "Tell us your target role and take the common assessment" },
  { at: ["COMMON_ASSESSMENT_COMPLETE"], label: "Take your career assessment" },
  { at: ["CAREER_ASSESSMENT_COMPLETE", "PROFILE_READY"], label: "Get your rating, skill graph and roadmap" },
];

/**
 * The locked state of every personalised page. No scores, no placeholders: it says what unlocks the page and offers the same
 * call to action as the banner (Continue when there is progress to resume).
 */
export function OnboardingGate({ status, feature = "this page" }: { status: OnboardingStatus; feature?: string }) {
  const current = STEPS.findIndex((s) => s.at.includes(status));
  return (
    <section className="mx-auto max-w-xl py-8" aria-labelledby="locked-title">
      <div className="glass relative overflow-hidden rounded-3xl p-8 text-center">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[var(--m-accent)] opacity-15 blur-3xl" />
        <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--m-ink)] text-white"><Lock className="h-5 w-5" aria-hidden /></span>
        <h1 id="locked-title" className="relative mt-4 font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">Finish your assessment to unlock {feature}</h1>
        <p className="relative mt-2 text-[14.5px] text-[var(--m-muted)]">It is built from your real results, so there is nothing to show until they exist.</p>
        <ol className="relative mx-auto mt-6 max-w-sm space-y-2.5 text-left">
          {STEPS.map((s, i) => (
            <li key={s.label} className={`flex items-start gap-3 text-[14px] ${i === current ? "font-bold text-[var(--m-ink)]" : "text-[var(--m-muted)]"}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i < current ? "bg-[var(--m-ink)] text-white" : i === current ? "border-2 border-[var(--m-accent)] text-[var(--m-accent-ink)]" : "border border-[var(--m-soft)]"}`} aria-hidden>
                {i < current ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
        <Link href="/assessment" className="relative mt-7 inline-flex items-center justify-center rounded-full bg-[var(--m-ink)] px-6 py-3 text-[14px] font-bold text-white shadow-[0_12px_24px_-12px_rgb(20_20_20/0.75)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]">
          {status === "ASSESSMENT_REQUIRED" ? "Start Assessment" : "Continue Assessment"}
        </Link>
      </div>
    </section>
  );
}
