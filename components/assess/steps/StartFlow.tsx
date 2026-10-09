"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Braces, CheckCheck, Eye, Gauge, Languages, Lock, Play, RefreshCw, Shuffle, X } from "lucide-react";
import type { SessionStart, SessionState } from "@/lib/assess/types";
import { ApiError, NetworkError, assessApi, sleep } from "../api";
import { Button } from "../ui/Button";

export type StartedSession = SessionStart & { state: SessionState };

export interface IntroSkill {
  name: string;
  importance?: string;
}
interface Props {
  layer: "GENERAL" | "CAREER";
  careerId?: string;
  careerName?: string | null;
  /** career: the role's skills; common: the sections (name = section label, importance unused) */
  items: IntroSkill[];
  /** common: questions per section label */
  sectionQuestions?: Record<string, number>;
  total: number;
  resuming?: boolean;
  onReady: (session: StartedSession) => void;
}

const STEPS = ["4", "3", "2", "1", "GO"];
const STEP_MS = 850;
const SECTION_ICON: Record<string, typeof Languages> = { Communication: Languages, "Basic Programming": Braces };

/**
 * Stage intro, then the 4-3-2-1-GO countdown. The countdown is pure UX and never waits on the model: the real work (creating the session
 * and choosing the first questions from the stored pool) starts the moment the button is pressed, and the status line only ever says
 * which of those two things is actually true right now. Cancel returns to the intro; the session simply stays open to resume.
 */
export function StartFlow({ layer, careerId, careerName, items, sectionQuestions, total, resuming, onReady }: Props) {
  const reduce = useReducedMotion();
  const isCareer = layer === "CAREER";
  const [step, setStep] = useState<number | null>(null);
  const [ready, setReady] = useState<StartedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0); // identifies the current attempt so a cancelled one can never call onReady

  const begin = useCallback(async () => {
    const mine = ++run.current;
    setError(null);
    setReady(null);
    setStep(0);
    try {
      const s = await assessApi.start(layer, careerId);
      if (run.current === mine) setReady(s);
    } catch (e) {
      if (run.current !== mine) return;
      setStep(null);
      setError(e instanceof NetworkError ? "We couldn't reach the server. Check your connection and try again." : e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }, [layer, careerId]);

  const cancel = () => { run.current++; setStep(null); setReady(null); };

  useEffect(() => {
    if (step === null || step >= STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => (s === null ? s : s + 1)), reduce ? 350 : STEP_MS);
    return () => clearTimeout(t);
  }, [step, reduce]);

  useEffect(() => {
    if (step !== STEPS.length - 1 || !ready) return;
    const mine = run.current;
    void sleep(reduce ? 200 : 550).then(() => { if (run.current === mine) onReady(ready); });
  }, [step, ready, onReady, reduce]);

  if (step !== null) return <Countdown step={step} waiting={step === STEPS.length - 1 && !ready} ready={!!ready} label={isCareer ? careerName ?? "Career assessment" : "Common assessment"} onCancel={cancel} reduce={!!reduce} />;

  const rules = isCareer
    ? [
        { icon: Gauge, title: "Adapts to you", body: "Difficulty rises and falls with your answers, and every important skill gets covered." },
        { icon: Lock, title: "First choice is final", body: "Options lock the instant you pick one. You see the answer and why, straight away." },
        { icon: Shuffle, title: "Real scenarios", body: "Business cases, queries, code and data, not definitions." },
      ]
    : [
        { icon: CheckCheck, title: "Same for everyone", body: "Every student gets the same sections, so results are comparable." },
        { icon: Lock, title: "First choice is final", body: "Options lock when you pick one, and feedback is instant." },
        { icon: Eye, title: "Never changes your rating", body: "This is a baseline for your profile. Your role rating comes from the career assessment." },
      ];
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:pt-12" aria-labelledby="intro-title">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="a-glass rounded-[2rem] p-6 sm:p-9">
          <p className="text-[13px] font-bold text-[var(--m-muted)]">{isCareer ? "Career assessment" : "Common assessment"} · {total} questions</p>
          <h1 id="intro-title" className="mt-1 text-balance font-lp-display text-[38px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[52px]">{isCareer ? careerName : "Two skills every role needs"}</h1>
          <ul className="mt-7 space-y-4">
            {rules.map((r) => (
              <li key={r.title} className="flex gap-3.5">
                <span className="a-glass-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--m-accent-ink)]"><r.icon className="h-[18px] w-[18px]" aria-hidden /></span>
                <div>
                  <p className="text-[15px] font-bold text-[var(--m-ink)]">{r.title}</p>
                  <p className="text-[14px] leading-relaxed text-[var(--m-muted)]">{r.body}</p>
                </div>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="mt-6 rounded-xl bg-[var(--bad-soft)] px-4 py-3 text-[14px] font-bold text-[var(--bad-ink)]">{error}</p>}
          <div className="mt-8">
            <Button variant="accent" size="lg" onClick={begin} icon={error ? <RefreshCw className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />} className="w-full sm:w-auto uppercase tracking-wide">
              {error ? "Try again" : resuming ? (isCareer ? "Resume career assessment" : "Resume common assessment") : isCareer ? "Start career assessment" : "Start common assessment"}
            </Button>
          </div>
        </motion.div>

        <motion.aside initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="a-glass-ink rounded-[2rem] p-6 sm:p-8" aria-label={isCareer ? "Skills that will be assessed" : "Sections"}>
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-white/70">{isCareer ? "Skills we'll look at" : "What's inside"}</h2>
          {isCareer ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {items.map((s) => (
                <li key={s.name} className={`rounded-full px-3 py-1.5 text-[13.5px] font-bold ${s.importance === "CRITICAL" ? "bg-white text-[var(--m-ink)]" : "bg-white/12 text-white ring-1 ring-white/15"}`}>{s.name}</li>
              ))}
            </ul>
          ) : (
            <ul className="mt-4 space-y-3">
              {items.map((s) => {
                const Icon = SECTION_ICON[s.name] ?? Braces;
                return (
                  <li key={s.name} className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[var(--m-ink)]"><Icon className="h-5 w-5" aria-hidden /></span>
                    <div>
                      <p className="text-[16px] font-bold">{s.name}</p>
                      <p className="text-[13px] text-white/70">{sectionQuestions?.[s.name] ?? "Several"} questions</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {isCareer && <p className="mt-5 text-[12.5px] leading-relaxed text-white/65">White skills carry the most weight in your role. Every skill appears on your skill graph, even those with too little evidence to score.</p>}
        </motion.aside>
      </div>
    </section>
  );
}

function Countdown({ step, waiting, ready, label, onCancel, reduce }: { step: number; waiting: boolean; ready: boolean; label: string; onCancel: () => void; reduce: boolean }) {
  const go = step === STEPS.length - 1;
  const R = 92;
  const C = 2 * Math.PI * R;
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center" aria-label="Starting">
      <p className="a-glass-soft rounded-full px-4 py-1.5 text-[13.5px] font-bold text-[var(--m-ink)]">{label}</p>
      <div className="relative my-8 flex h-[260px] w-[260px] items-center justify-center" aria-live="assertive" aria-atomic="true">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(23 19 31 / 0.1)" strokeWidth="6" />
          <motion.circle
            key={step}
            cx="100" cy="100" r={R} fill="none" stroke="var(--m-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C}
            initial={{ strokeDashoffset: go ? 0 : C }} animate={{ strokeDashoffset: 0 }} transition={{ duration: go || reduce ? 0.2 : STEP_MS / 1000, ease: "linear" }}
          />
        </svg>
        <span className="a-glass absolute inset-5 rounded-full" aria-hidden />
        <motion.span
          key={step}
          initial={reduce ? false : { scale: 0.55, opacity: 0, filter: "blur(8px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 240, damping: 16 }}
          className={`relative font-lp-display font-bold leading-none text-[var(--m-ink)] ${go ? "text-[76px]" : "text-[96px]"}`}
        >
          {STEPS[step]}
        </motion.span>
      </div>
      <p role="status" className="flex min-h-6 items-center gap-2 text-[14.5px] font-bold text-[var(--m-muted)]">
        {ready ? "Your session is ready." : <><span className="h-2 w-2 animate-pulse rounded-full bg-[var(--m-accent)]" aria-hidden />{waiting ? "Still preparing your first questions. One moment." : "Preparing your session and first questions."}</>}
      </p>
      <Button variant="ghost" onClick={onCancel} icon={<X className="h-4 w-4" aria-hidden />} className="mt-6">Cancel</Button>
    </section>
  );
}
