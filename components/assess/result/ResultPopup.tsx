"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Lightbulb, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { StoredFeedback } from "@/lib/assess/feedback";
import type { SectionBar } from "@/lib/assess/scoring";
import type { AssessmentResult } from "@/lib/assess/types";
import { assessApi } from "../api";
import { displayRating } from "@/lib/assess/career-profile";
import { useCareerProfile } from "../hooks/useCareerProfile";
import { useCountUp } from "../hooks/useCountUp";
import { useFeedback } from "../hooks/useFeedback";
import { Button } from "../ui/Button";

/**
 * Shown straight after Submit. The ELO and the common bars are deterministic and render immediately; the AI feedback shows a
 * skeleton until it exists (and is replaced by a template server-side if the model is slow or down), so this is never blank.
 * The rating shown comes from the shared career profile, the same value the dashboard shows.
 */
export function ResultPopup({ sessionId, result }: { sessionId: string; result: AssessmentResult }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const reduce = !!useReducedMotion();
  const { profile } = useCareerProfile();
  const { feedback, failed } = useFeedback(sessionId);
  const elo = result.elo!;
  // the profile is the source of truth once it has loaded; until then the session summary already carries the same number
  const rating = displayRating(profile, elo.newElo);
  const shown = useCountUp(rating, 1100);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    void assessApi.event("assessment_popup_viewed");
  }, []);

  const goDashboard = () => {
    void assessApi.event("dashboard_opened_after_assessment");
    router.push("/dashboard");
  };

  const stats: [string, string, "up" | "down" | undefined][] = [
    ["Starting ELO", String(elo.startingElo), undefined],
    ["Correct", String(elo.correct), undefined],
    ["Incorrect", String(elo.incorrect), undefined],
    ["ELO gained", `+${elo.gained}`, "up"],
    ["ELO lost", `−${elo.lost}`, "down"],
    ["Net change", `${elo.net >= 0 ? "+" : "−"}${Math.abs(elo.net)}`, elo.net >= 0 ? "up" : "down"],
  ];

  return (
    <dialog ref={ref} aria-labelledby="popup-title" onCancel={(e) => e.preventDefault()} className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-[#17131f]/55 backdrop:backdrop-blur-md">
      <div className="metro a-stage !min-h-0 h-full overflow-y-auto" data-area="assess" data-stage="results" style={{ background: "transparent" }}>
        <div className="mx-auto flex min-h-full max-w-5xl items-center px-3 py-6 sm:px-6">
          <motion.div initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} className="a-glass relative w-full overflow-hidden rounded-[2rem] p-5 sm:p-9">
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--hue-b)] opacity-40 blur-3xl" />
            <header className="relative">
              <p className="flex items-center gap-2 text-[13px] font-bold text-[var(--m-muted)]"><Sparkles className="h-4 w-4 text-[var(--m-accent)]" aria-hidden /> Assessment complete</p>
              <h1 id="popup-title" className="mt-1 text-balance font-lp-display text-[34px] font-bold leading-tight tracking-tight text-[var(--m-ink)] sm:text-[44px]">Here&apos;s where you stand as a {result.career?.name}</h1>
            </header>

            <div className="relative mt-7 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
              <section className="a-glass-ink rounded-3xl p-6" aria-label="Career ELO">
                <p className="text-[12px] font-bold uppercase tracking-wider text-white/65">{result.career?.name} ELO</p>
                <p className="mt-1 font-lp-display text-[76px] font-bold leading-none tabular-nums" aria-label={`ELO ${rating}`}>{shown}</p>
                <p className={`mt-2 inline-flex items-center gap-1.5 text-[15px] font-bold ${elo.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {elo.net >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
                  {elo.net >= 0 ? "+" : "−"}{Math.abs(elo.net)} from {elo.startingElo}
                </p>
                <dl className="mt-5 grid grid-cols-3 gap-2.5">
                  {stats.map(([label, value, tone]) => (
                    <div key={label} className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/10">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-white/60">{label}</dt>
                      <dd className={`mt-0.5 font-lp-display text-[22px] font-bold tabular-nums ${tone === "up" ? "text-emerald-300" : tone === "down" ? "text-rose-300" : ""}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[12.5px] leading-relaxed text-white/65">Your Arena performance will continue to update this score.</p>
              </section>

              <div className="space-y-5">
                {result.general && <CommonBars bars={result.general} reduce={reduce} />}
                <FeedbackBlocks feedback={feedback} failed={failed} />
              </div>
            </div>

            <footer className="relative mt-7 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[13px] text-[var(--m-muted)]">Your full skill graph and roadmap are ready on your dashboard.</p>
              <Button variant="accent" size="lg" onClick={goDashboard} iconAfter={<ArrowRight className="h-5 w-5" aria-hidden />}>Go to Dashboard</Button>
            </footer>
          </motion.div>
        </div>
      </div>
    </dialog>
  );
}

function CommonBars({ bars, reduce }: { bars: SectionBar[]; reduce: boolean }) {
  return (
    <section className="a-glass-soft rounded-3xl p-5" aria-labelledby="common-title">
      <h2 id="common-title" className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Common assessment</h2>
      <ul className="mt-3 space-y-4">
        {bars.map((b) => (
          <li key={b.section}>
            <div className="flex items-baseline justify-between gap-3 text-[14.5px] font-bold text-[var(--m-ink)]"><span>{b.label}</span><span className="tabular-nums">{b.score === null ? "—" : `${b.score}`}<span className="text-[12px] font-normal text-[var(--m-muted)]"> /100 · {b.correct}/{b.total} correct</span></span></div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[var(--m-ink)]/10" role="meter" aria-label={b.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={b.score ?? 0}>
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--hue-a)] to-[var(--hue-b)]" initial={reduce ? false : { width: 0 }} animate={{ width: `${b.score ?? 0}%` }} transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeedbackBlocks({ feedback, failed }: { feedback: StoredFeedback[] | null; failed: boolean }) {
  const parts: { key: "COMMON" | "CAREER"; title: string }[] = [{ key: "COMMON", title: "On your common assessment" }, { key: "CAREER", title: "On your career assessment" }];
  return (
    <section className="a-glass-soft rounded-3xl p-5" aria-labelledby="fb-title" aria-busy={!feedback && !failed}>
      <h2 id="fb-title" className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]"><Lightbulb className="h-3.5 w-3.5" aria-hidden /> Feedback</h2>
      {!feedback && !failed ? (
        <div className="mt-3 space-y-2.5" role="status" aria-label="Writing your feedback"><span className="a-skeleton block h-4 w-11/12" /><span className="a-skeleton block h-4 w-9/12" /><span className="a-skeleton block h-4 w-10/12" /></div>
      ) : (
        <div className="mt-3 space-y-5">
          {parts.map(({ key, title }) => {
            const f = feedback?.find((x) => x.part === key);
            if (!f) return null;
            return (
              <article key={key}>
                <h3 className="text-[14.5px] font-bold text-[var(--m-ink)]">{title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-[var(--m-ink)]/85">{f.body.summary}</p>
                <ul className="mt-2 space-y-1 text-[13.5px] text-[var(--m-ink)]/85">
                  {f.body.strengths.map((s) => <li key={s} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ok)]" aria-hidden /><span><span className="sr-only">Strength: </span>{s}</span></li>)}
                  {f.body.focusAreas.map((s) => <li key={s} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--m-accent)]" aria-hidden /><span><span className="sr-only">Focus area: </span>{s}</span></li>)}
                </ul>
                <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-[13.5px] font-bold text-[var(--m-ink)]">Next step: <span className="font-normal">{f.body.nextStep}</span></p>
              </article>
            );
          })}
          {(failed || (feedback && feedback.length === 0)) && !feedback?.length && <p className="text-[14px] text-[var(--m-muted)]">Your results are saved. Written feedback will appear on your dashboard.</p>}
        </div>
      )}
    </section>
  );
}
