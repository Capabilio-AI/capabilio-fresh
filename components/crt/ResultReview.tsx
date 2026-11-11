"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { AnswerResult, QuizQuestion } from "@/lib/crt/studio-server";
import { CoachBox } from "./Coach";

/** What the exam sends for a question that was left unanswered: it scores zero. */
export const SKIPPED = "-";

/** Every question of a finished test with the best answer and the reasoning, and the coach for the ones that were missed. */
export function ResultReview({ questions, results }: { questions: QuizQuestion[]; results: AnswerResult[] }) {
  const byId = new Map(results.map((r) => [r.questionId, r]));
  return (
    <>
    <ol className="flex flex-col gap-3">
      {questions.map((q, i) => {
        const r = byId.get(q.id);
        if (!r) return null;
        const chosen = q.options.find((o) => o.key === r.chosenKey)?.text;
        return (
          <li key={q.id} className="rounded-xl border border-app-border bg-white p-4">
            <p className="flex items-start gap-2 font-lp-body text-[14px] font-semibold text-app-charcoal">
              {r.correct ? <CheckCircle2 size={17} aria-label="Correct" className="mt-0.5 shrink-0 text-app-success" /> : <XCircle size={17} aria-label="Not correct" className="mt-0.5 shrink-0 text-app-warning" />}
              <span className="whitespace-pre-line">{i + 1}. {q.prompt}</span>
            </p>
            {!r.correct && <p className="mt-2 font-lp-body text-[13px] text-app-muted">You chose: <span className="text-app-charcoal">{chosen ?? "no answer"}</span></p>}
            <p className="mt-1 font-lp-body text-[13px] text-app-muted">Best answer: <span className="font-semibold text-app-charcoal">{r.bestText}</span></p>
            {r.explanation && <p className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">{r.explanation}</p>}
            {!r.correct && <div className="mt-3"><CoachBox questionId={q.id} chosenKey={r.chosenKey === SKIPPED ? undefined : r.chosenKey} label="Explain my mistake" /></div>}
          </li>
        );
      })}
    </ol>
    <p className="mt-3 font-lp-body text-[11.5px] text-app-muted">Some aptitude questions are adapted from AQuA-RAT by DeepMind (Apache License 2.0). Others are written for Capabilio and checked before use.</p>
    </>
  );
}
