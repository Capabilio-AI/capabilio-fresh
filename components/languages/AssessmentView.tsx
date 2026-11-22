import clsx from "clsx";
import { CheckCircle2, XCircle } from "lucide-react";
import type { ReviewItem } from "@/lib/languages/module-gate";

export interface TestQuestion { id: string; question: string; options: string[]; code?: string }

/** A program a student reads. Wide code scrolls sideways instead of wrapping, so the lines stay the way they are written. */
function Code({ code }: { code: string }) {
  return <pre className="ss-scroll mt-2 overflow-x-auto rounded-lg bg-[var(--m-ink)] p-4 font-lp-mono text-[13px] leading-relaxed text-white"><code>{code}</code></pre>;
}

/**
 * The questions of one attempt. A question with code is "what does this print?": the program is shown first and the options are outputs, so they are
 * set in the same plain monospace as the code and keep their line breaks.
 */
export function QuestionList({ questions, answers, onPick, track }: { questions: TestQuestion[]; answers: Record<string, number>; onPick: (id: string, option: number) => void; track: string }) {
  return (
    <ol className="mt-4 flex flex-col gap-6">
      {questions.map((q, qi) => (
        <li key={q.id}>
          <fieldset>
            <legend className="text-[15.5px] font-bold text-[var(--m-ink)]"><span className="ss-num mr-1 text-[var(--m-muted)]">{qi + 1}.</span>{q.question}</legend>
            {q.code && <Code code={q.code} />}
            {q.code && track === "c" && <p className="mt-1 text-[12.5px] text-[var(--m-muted)]">stdio.h, string.h and stdlib.h are already included.</p>}
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((o, oi) => (
                <label key={oi} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--m-rule)] px-3 py-2 text-[14.5px] text-[var(--m-ink)] has-[:checked]:border-[var(--m-ink)] has-[:checked]:bg-[var(--m-ground)]">
                  <input type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => onPick(q.id, oi)} className="mt-1 shrink-0" />
                  <span className={clsx(q.code && "whitespace-pre-wrap break-all font-lp-mono text-[13.5px]")}>{o}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}

/** After a miss: each question that was wrong, with the right answer and the reason. A miss should teach, not only block. */
export function ReviewList({ items }: { items: ReviewItem[] }) {
  return (
    <ol className="mt-3 flex flex-col gap-5" aria-label="Questions you missed">
      {items.map((r, i) => (
        <li key={r.id} className="rounded-xl border border-[var(--m-rule)] bg-white p-4">
          <p className="text-[15px] font-bold text-[var(--m-ink)]"><span className="ss-num mr-1 text-[var(--m-muted)]">{i + 1}.</span>{r.question}</p>
          {r.code && <Code code={r.code} />}
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {r.options.map((o, oi) => {
              const right = oi === r.correctIndex;
              const mine = oi === r.yourIndex;
              return (
                <div key={oi} className={clsx("flex items-start gap-2 rounded-lg border px-3 py-2 text-[14px]", right ? "border-[#17784a] bg-[#e8f5ee] text-[#0f5132]" : mine ? "border-red-300 bg-red-50 text-red-800" : "border-[var(--m-rule)] text-[var(--m-muted)]")}>
                  {right ? <CheckCircle2 size={15} aria-hidden className="mt-0.5 shrink-0" /> : mine ? <XCircle size={15} aria-hidden className="mt-0.5 shrink-0" /> : <span className="w-[15px] shrink-0" aria-hidden />}
                  <span className={clsx("whitespace-pre-wrap break-all", r.code && "font-lp-mono text-[13px]")}>{o}<span className="sr-only">{right ? " (right answer)" : mine ? " (your answer)" : ""}</span></span>
                </div>
              );
            })}
          </div>
          {r.why && <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--m-ink)]"><span className="font-bold">Why: </span>{r.why}</p>}
        </li>
      ))}
    </ol>
  );
}
