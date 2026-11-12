"use client";

import { useCallback, useRef, useState } from "react";
import { BAND_LABEL, MODULE_LABEL } from "@/lib/crt/model";
import type { AttemptResult, RunnerPayload } from "@/lib/crt/server";
import { negativeMarkingNote } from "@/lib/crt/marking";
import { ExamRunner, type ExamQuestion } from "./ExamRunner";
import { ModuleBars } from "./ModuleBars";
import { crtPost } from "./api";

const SAVE_DELAY_MS = 800;

/** The placement cell's assessment, taken in the exam screen. Answers save as they are chosen, so a refresh or a dropped connection loses nothing. */
export function CrtRunner({ payload, onClose }: { payload: RunnerPayload; onClose: () => void }) {
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);

  const questions: ExamQuestion[] = payload.questions.map((q) => ({ id: q.id, section: MODULE_LABEL[q.module], topic: q.topic, prompt: q.prompt, options: q.options }));

  const flush = useCallback(async () => {
    const answers = pending.current;
    if (Object.keys(answers).length === 0 || done.current) return;
    pending.current = {};
    try {
      await crtPost({ action: "save", attemptId: payload.attemptId, answers });
    } catch {
      pending.current = { ...answers, ...pending.current }; // kept for the next try
    }
  }, [payload.attemptId]);

  function onAnswersChange(answers: Record<string, string>) {
    pending.current = answers;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  async function onSubmit(answers: Record<string, string>) {
    done.current = true;
    if (timer.current) clearTimeout(timer.current);
    setError(null);
    try {
      const out = await crtPost<{ result: AttemptResult }>({ action: "submit", attemptId: payload.attemptId, answers });
      try {
        window.localStorage.removeItem(`crt-spent-${payload.attemptId}`);
      } catch {
        /* nothing stored */
      }
      setResult(out.result);
    } catch (e) {
      done.current = false;
      setError(e instanceof Error ? e.message : "Could not submit. Please try again.");
      throw e;
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--m-ground)] p-5 sm:p-10" role="dialog" aria-modal="true" aria-label="Your CRT result">
        <div className="mx-auto max-w-xl rounded-2xl border border-app-border bg-white p-6 sm:p-8">
          <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">{payload.cycleTitle}</p>
          <h2 className="mt-1 font-lp-display text-[28px] font-bold text-app-charcoal">Assessment submitted</h2>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-lp-display text-[56px] font-bold leading-none tabular-nums text-app-charcoal">{result.totalPct}%</span>
            <span className="mb-1.5 rounded-full bg-[var(--m-accent-soft)] px-3 py-1 font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">{BAND_LABEL[result.band]}</span>
          </div>
          <div className="mt-6"><ModuleBars scores={result.moduleScores} /></div>
          <p className="mt-6 font-lp-body text-[13px] text-app-muted">{negativeMarkingNote()} Your placement cell can see this score. Practise the sections you found hard in the Placement Simulator.</p>
          <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">Back to CRT</button>
        </div>
      </div>
    );
  }

  return <ExamRunner title={payload.cycleTitle} questions={questions} initialAnswers={payload.answers} deadlineAt={payload.deadlineAt} storageKey={`crt-spent-${payload.attemptId}`} onAnswersChange={onAnswersChange} onSubmit={onSubmit} error={error} />;
}
