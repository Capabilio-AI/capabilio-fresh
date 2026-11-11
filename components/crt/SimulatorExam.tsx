"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { SimTestKey } from "@/lib/crt/categories";
import type { AnswerResult, QuizQuestion, TimedSet } from "@/lib/crt/studio-server";
import { ExamRunner } from "./ExamRunner";
import { ResultReview, SKIPPED } from "./ResultReview";
import { crtPost } from "./api";
import { useLoad } from "./use-load";

interface Graded {
  results: AnswerResult[];
  pct: number;
  questions: QuizQuestion[];
  /** set for a company mock, which can take marks off wrong answers */
  negativeMarking?: number;
  wrong?: number;
  unanswered?: number;
  rawPct?: number;
}

function Frame({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--m-ground)]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <h2 className="font-lp-display text-[24px] font-bold text-app-charcoal">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-app-muted hover:bg-[var(--m-accent-soft)]"><X size={20} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Result({ graded, title, onClose }: { graded: Graded; title: string; onClose: () => void }) {
  const sections = [...new Set(graded.questions.map((q) => q.section ?? "Questions"))].map((name) => {
    const ids = new Set(graded.questions.filter((q) => (q.section ?? "Questions") === name).map((q) => q.id));
    const rs = graded.results.filter((r) => ids.has(r.questionId));
    const max = rs.reduce((s, r) => s + r.max, 0);
    return { name, correct: rs.filter((r) => r.correct).length, total: rs.length, pct: max ? Math.round((rs.reduce((s, r) => s + r.points, 0) / max) * 100) : 0 };
  });
  const correct = graded.results.filter((r) => r.correct).length;
  const skipped = graded.results.filter((r) => r.chosenKey === SKIPPED).length;
  return (
    <Frame title={title} onClose={onClose}>
      <div className="rounded-2xl border border-app-border bg-white p-5 sm:p-6">
        <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Your result</p>
        <div className="mt-1 flex items-end gap-3">
          <span className="font-lp-display text-[52px] font-bold leading-none tabular-nums text-app-charcoal">{graded.pct}%</span>
          <span className="mb-1.5 font-lp-body text-[14px] text-app-muted">{correct} of {graded.results.length} correct{skipped ? `, ${skipped} unanswered` : ""}</span>
        </div>
        {sections.length > 1 && (
          <ul className="mt-5 flex flex-col gap-3">
            {sections.map((s) => (
              <li key={s.name}>
                <div className="mb-1 flex justify-between font-lp-body text-[13px]"><span className="font-semibold text-app-charcoal">{s.name}</span><span className="tabular-nums text-app-muted">{s.correct}/{s.total} · {s.pct}%</span></div>
                <div role="meter" aria-label={s.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pct} className="h-2 overflow-hidden rounded-full bg-[var(--m-accent-soft)]"><div className={`h-full rounded-full ${s.pct >= 60 ? "bg-app-success" : "bg-app-warning"}`} style={{ width: `${s.pct}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
        {graded.negativeMarking ? <p className="mt-4 rounded-lg bg-[var(--m-ground)] px-3 py-2 font-lp-body text-[13px] text-app-charcoal">This paper takes {graded.negativeMarking} of a mark off each wrong answer: {graded.wrong ?? 0} wrong, {graded.unanswered ?? 0} left blank. Without negative marking your score would be {graded.rawPct ?? graded.pct}%.</p> : null}
        <p className="mt-5 font-lp-body text-[12.5px] text-app-muted">Every answer is now part of your readiness. Questions you missed are explained below.</p>
        <button type="button" onClick={onClose} className="mt-4 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">Back to CRT</button>
      </div>
      <ResultReview questions={graded.questions} results={graded.results} />
    </Frame>
  );
}

/** A timed test in the exam screen, graded and explained at the end. `loadBody` and `gradeBody` say which test it is. */
function ExamSession({ loadBody, gradeBody, fallbackTitle, onClose }: { loadBody: Record<string, unknown>; gradeBody: Record<string, unknown>; fallbackTitle: string; onClose: () => void }) {
  const { data, error } = useLoad<{ set: TimedSet }>(loadBody);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (graded) return <Result graded={graded} title={data?.set.title ?? fallbackTitle} onClose={onClose} />;
  if (!data) {
    return (
      <Frame title={fallbackTitle} onClose={onClose}>
        {error ? <p role="alert" className="rounded-xl border border-app-warning/40 bg-app-warning/10 p-4 font-lp-body text-[13.5px] text-app-charcoal">{error}</p> : <p className="flex items-center gap-2 font-lp-body text-[13.5px] text-app-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Setting up your test…</p>}
      </Frame>
    );
  }

  const { set } = data;
  async function onSubmit(answers: Record<string, string>) {
    setSubmitError(null);
    try {
      // a question left blank is graded as zero, like in a real test
      const all = Object.fromEntries(set.questions.map((q) => [q.id, answers[q.id] ?? SKIPPED]));
      setGraded(await crtPost<Graded>({ ...gradeBody, answers: all }));
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not grade your test. Please try again.");
      throw e;
    }
  }
  return <ExamRunner title={set.title} secondsPerQuestion={set.secondsPerQuestion} questions={set.questions.map((q) => ({ id: q.id, section: q.section ?? "Questions", topic: q.topic, prompt: q.prompt, options: q.options }))} onSubmit={onSubmit} onExit={onClose} error={submitError} />;
}

/** One placement-simulator test in the exam screen, graded and explained at the end. */
export function SimulatorExam({ test, onClose }: { test: SimTestKey; onClose: () => void }) {
  return <ExamSession loadBody={{ action: "simulator", test }} gradeBody={{ action: "grade", test }} fallbackTitle="Placement simulator" onClose={onClose} />;
}

/** One company round as a timed mock, in the company's sections, time and negative marking. */
export function CompanyExam({ roundId, onClose }: { roundId: string; onClose: () => void }) {
  return <ExamSession loadBody={{ action: "company_mock", roundId }} gradeBody={{ action: "company_grade", roundId }} fallbackTitle="Company mock test" onClose={onClose} />;
}
