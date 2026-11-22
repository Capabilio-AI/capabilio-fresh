"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CircleCheck, CircleHelp } from "lucide-react";

/**
 * Questions to answer from memory right after learning. Watching or reading feels like knowing; answering shows what actually stuck,
 * so this sits under every lesson. It is practice only: it never changes a score.
 */
export interface Verdict { correct: boolean; answerIndex: number; why: string }
/** A question as the page holds it. Where the answers must not reach the browser they are left out and `grade` asks the server instead. */
export interface CheckItem { question: string; options: string[]; answerIndex?: number; why?: string }

export function CheckYourself({ questions, id, onDone, grade }: {
  questions: CheckItem[];
  id: string;
  onDone?: (right: number, total: number) => void;
  /** marks one answer on the server; when it is given the questions carry no answers */
  grade?: (questionIndex: number, optionIndex: number) => Promise<Verdict>;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({});
  const [failed, setFailed] = useState<number | null>(null);
  const reported = useRef(false);
  const choose = async (qi: number, oi: number) => {
    setPicked((p) => ({ ...p, [qi]: oi }));
    setFailed(null);
    let verdict: Verdict;
    if (grade) {
      try { verdict = await grade(qi, oi); } catch {
        // the answer was never marked: let the student pick again
        setPicked((p) => Object.fromEntries(Object.entries(p).filter(([k]) => Number(k) !== qi)));
        setFailed(qi);
        return;
      }
    } else {
      const q = questions[qi];
      verdict = { correct: oi === q.answerIndex, answerIndex: q.answerIndex ?? 0, why: q.why ?? "" };
    }
    setVerdicts((v) => ({ ...v, [qi]: verdict }));
  };
  const answered = Object.keys(verdicts).length;
  const right = Object.values(verdicts).filter((v) => v.correct).length;
  const done = answered === questions.length;
  useEffect(() => {
    if (done && onDone && !reported.current) { reported.current = true; onDone(right, questions.length); }
  }, [done, onDone, right, questions.length]);

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-2xl border border-[var(--m-ink)] bg-white p-5">
      <h3 id={`${id}-h`} className="flex items-center gap-2 font-lp-display text-[20px] font-bold text-[var(--m-ink)]"><CircleHelp size={18} aria-hidden className="text-[var(--m-accent)]" />Check yourself</h3>
      <p className="mt-1 text-[14px] text-[var(--m-muted)]">Answer before you look anything up. It shows what really stuck.</p>
      <div className="mt-4 flex flex-col gap-4">
        {questions.map((q, qi) => {
          const choice = picked[qi];
          return (
            <fieldset key={qi} className="rounded-xl border border-[var(--m-rule)] p-4">
              <legend className="px-1 text-[15px] font-bold text-[var(--m-ink)]">{qi + 1}. {q.question}</legend>
              <div className="mt-1 flex flex-col gap-1.5">
                {q.options.map((o, oi) => (
                  <label key={oi} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-[14.5px] transition-colors motion-reduce:transition-none", choice === oi ? "border-[var(--m-ink)] bg-[var(--m-ground)]" : "border-transparent hover:bg-[var(--m-ground)]")}>
                    <input type="radio" name={`${id}-${qi}`} checked={choice === oi} disabled={choice !== undefined} onChange={() => choose(qi, oi)} className="mt-1 accent-[var(--m-ink)]" />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
              {choice !== undefined && verdicts[qi] === undefined && <p role="status" className="mt-2 text-[14px] text-[var(--m-muted)]">Checking…</p>}
              {failed === qi && <p role="alert" className="mt-2 text-[14px] text-[var(--m-ink)]">Could not check that answer. Check your connection and pick again.</p>}
              {verdicts[qi] !== undefined && (
                <p role="status" className={clsx("mt-2 text-[14px]", verdicts[qi].correct ? "font-bold text-[#17784a]" : "text-[var(--m-ink)]")}>
                  {verdicts[qi].correct ? "Correct. " : `Not quite. The answer is “${q.options[verdicts[qi].answerIndex]}”. `}{verdicts[qi].why}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>
      {done && (
        <p role="status" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[var(--m-ground)] px-4 py-3 text-[14.5px] text-[var(--m-ink)]">
          <CircleCheck size={16} aria-hidden className="shrink-0" />
          <span className="ss-num font-bold">{right} of {questions.length} right.</span>
          <span>{right === questions.length ? "Now prove it on real work in Arena." : "Go back over the parts you missed, then try again."}</span>
          <Link href="/arena" className="font-bold text-[var(--m-accent-ink)] hover:underline">Open Arena</Link>
        </p>
      )}
    </section>
  );
}
