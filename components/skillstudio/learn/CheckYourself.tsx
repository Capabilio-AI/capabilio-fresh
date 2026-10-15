"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CircleCheck, CircleHelp } from "lucide-react";
import type { CheckQuestion } from "@/lib/skillstudio/lesson-content";

/**
 * Questions to answer from memory right after learning. Watching or reading feels like knowing; answering shows what actually stuck,
 * so this sits under every lesson. It is practice only: it never changes a score.
 */
export function CheckYourself({ questions, id }: { questions: CheckQuestion[]; id: string }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const right = questions.filter((q, i) => picked[i] === q.answerIndex).length;
  const done = answered === questions.length;

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
                    <input type="radio" name={`${id}-${qi}`} checked={choice === oi} disabled={choice !== undefined} onChange={() => setPicked((p) => ({ ...p, [qi]: oi }))} className="mt-1 accent-[var(--m-ink)]" />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
              {choice !== undefined && (
                <p role="status" className={clsx("mt-2 text-[14px]", choice === q.answerIndex ? "font-bold text-[#17784a]" : "text-[var(--m-ink)]")}>
                  {choice === q.answerIndex ? "Correct. " : `Not quite. The answer is “${q.options[q.answerIndex]}”. `}{q.why}
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
