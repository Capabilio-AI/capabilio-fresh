"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { BAND_LABEL, MODULE_LABEL } from "@/lib/crt/model";
import type { AttemptResult, RunnerPayload } from "@/lib/crt/server";
import { ModuleBars } from "./ModuleBars";
import { crtPost, formatClock } from "./api";

const SAVE_DELAY_MS = 800;

/** The timed assessment, full screen. Answers save as the student picks them, so a refresh or a dropped connection loses nothing. */
export function CrtRunner({ payload, onClose }: { payload: RunnerPayload; onClose: () => void }) {
  const { questions } = payload;
  const [answers, setAnswers] = useState<Record<string, string>>(payload.answers);
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !payload.answers[q.id])));
  const [remaining, setRemaining] = useState(() => (Date.parse(payload.deadlineAt) - Date.now()) / 1000);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const dirty = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef(false);

  const flush = useCallback(async () => {
    const pending = dirty.current;
    if (Object.keys(pending).length === 0 || submitted.current) return;
    dirty.current = {};
    try {
      await crtPost({ action: "save", attemptId: payload.attemptId, answers: pending });
    } catch {
      dirty.current = { ...pending, ...dirty.current }; // keep it for the next try
    }
  }, [payload.attemptId]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    try {
      const out = await crtPost<{ result: AttemptResult }>({ action: "submit", attemptId: payload.attemptId, answers });
      setResult(out.result);
    } catch (e) {
      submitted.current = false;
      setError(e instanceof Error ? e.message : "Could not submit. Please try again.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }, [answers, payload.attemptId]);

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // the clock ticks here, and running out of time submits whatever has been answered
  useEffect(() => {
    if (result) return;
    const id = setInterval(() => {
      const left = (Date.parse(payload.deadlineAt) - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) void submitRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [payload.deadlineAt, result]);

  useEffect(() => {
    if (result) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [result]);

  function choose(questionId: string, key: string) {
    setAnswers((a) => ({ ...a, [questionId]: key }));
    dirty.current = { ...dirty.current, [questionId]: key };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  const answered = useMemo(() => questions.filter((q) => answers[q.id]).length, [questions, answers]);
  const q = questions[index];
  const low = remaining <= 300;

  if (result) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--m-bg,#fff)] p-5 sm:p-10" role="dialog" aria-modal="true" aria-label="Your CRT result">
        <div className="mx-auto max-w-xl rounded-2xl border border-app-border bg-white p-6 sm:p-8">
          <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">{payload.cycleTitle}</p>
          <h2 className="mt-1 font-lp-display text-[28px] font-bold text-app-charcoal">Assessment submitted</h2>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-lp-display text-[56px] font-bold leading-none tabular-nums text-app-charcoal">{result.totalPct}%</span>
            <span className="mb-1.5 rounded-full bg-[var(--m-accent-soft)] px-3 py-1 font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">{BAND_LABEL[result.band]}</span>
          </div>
          <div className="mt-6"><ModuleBars scores={result.moduleScores} /></div>
          <p className="mt-6 font-lp-body text-[13px] text-app-muted">Your placement cell can see this score. The training sessions for your weaker modules are on the CRT page.</p>
          <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">Back to CRT</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--m-bg,#fff)]" role="dialog" aria-modal="true" aria-label="CRT assessment">
      <header className="flex items-center justify-between gap-3 border-b border-app-border bg-white px-4 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="truncate font-lp-body text-[13px] font-semibold text-app-charcoal">{payload.cycleTitle}</p>
          <p className="font-lp-body text-[12px] text-app-muted">{answered} of {questions.length} answered</p>
        </div>
        <p className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-lp-body text-[14px] font-bold tabular-nums ${low ? "bg-app-orange/15 text-app-orange" : "bg-[var(--m-accent-soft)] text-[var(--m-ink)]"}`} role="timer" aria-label="Time remaining">
          <Clock size={14} aria-hidden /> {formatClock(remaining)}
        </p>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row">
        <main className="mx-auto w-full max-w-2xl flex-1 p-5 sm:p-8">
          <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">{MODULE_LABEL[q.module]} · {q.topic} · Question {index + 1} of {questions.length}</p>
          <h2 className="mt-3 whitespace-pre-line font-lp-display text-[20px] font-semibold leading-snug text-app-charcoal sm:text-[22px]">{q.prompt}</h2>
          <div role="radiogroup" aria-label="Answer options" className="mt-6 flex flex-col gap-3">
            {q.options.map((o) => {
              const on = answers[q.id] === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(q.id, o.key)}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left font-lp-body text-[14.5px] transition-colors motion-reduce:transition-none ${on ? "border-[var(--m-ink)] bg-[var(--m-accent-soft)] text-app-charcoal" : "border-app-border bg-white text-app-charcoal hover:bg-[var(--m-accent-soft)]/60"}`}
                >
                  <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold uppercase ${on ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-app-border text-app-muted"}`}>{o.key}</span>
                  <span>{o.text}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-lp-body text-[13.5px] font-semibold text-app-charcoal hover:bg-[var(--m-accent-soft)] disabled:opacity-40"><ChevronLeft size={16} aria-hidden /> Previous</button>
            {index < questions.length - 1 ? (
              <button type="button" onClick={() => setIndex((i) => i + 1)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13.5px] font-semibold text-white">Next <ChevronRight size={16} aria-hidden /></button>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="rounded-lg bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13.5px] font-semibold text-white">Review and submit</button>
            )}
          </div>
        </main>

        <aside className="border-t border-app-border bg-white p-5 lg:w-72 lg:border-l lg:border-t-0">
          <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Questions</p>
          <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
            {questions.map((x, i) => (
              <button key={x.id} type="button" onClick={() => setIndex(i)} aria-label={`Question ${i + 1}${answers[x.id] ? ", answered" : ""}`} aria-current={i === index ? "true" : undefined}
                className={`h-9 rounded-lg border font-lp-body text-[12.5px] font-semibold tabular-nums ${i === index ? "border-[var(--m-ink)] ring-2 ring-[var(--m-ink)]/20" : "border-app-border"} ${answers[x.id] ? "bg-[var(--m-ink)] text-white" : "bg-white text-app-charcoal"}`}>{i + 1}</button>
            ))}
          </div>
          <button type="button" onClick={() => setConfirming(true)} className="mt-5 w-full rounded-xl border border-app-border px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-app-charcoal hover:bg-[var(--m-accent-soft)]">Submit assessment</button>
          <p className="mt-3 font-lp-body text-[12px] leading-relaxed text-app-muted">Your answers save automatically. When the timer reaches zero the assessment submits itself.</p>
        </aside>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--m-ink)]/50 p-4" role="alertdialog" aria-modal="true" aria-label="Submit assessment">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="font-lp-display text-[20px] font-bold text-app-charcoal">Submit now?</h3>
            <p className="mt-2 font-lp-body text-[13.5px] text-app-muted">{answered === questions.length ? "You have answered every question." : `${questions.length - answered} question${questions.length - answered === 1 ? " is" : "s are"} still unanswered and will score zero.`} You cannot change answers after submitting.</p>
            {error && <p role="alert" className="mt-3 font-lp-body text-[13px] text-app-orange">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-lg px-4 py-2 font-lp-body text-[13.5px] font-semibold text-app-charcoal hover:bg-[var(--m-accent-soft)]">Keep working</button>
              <button type="button" onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Submit</button>
            </div>
          </div>
        </div>
      )}
      {!confirming && error && <p role="alert" className="border-t border-app-border bg-white px-5 py-2 font-lp-body text-[13px] text-app-orange">{error}</p>}
    </div>
  );
}
