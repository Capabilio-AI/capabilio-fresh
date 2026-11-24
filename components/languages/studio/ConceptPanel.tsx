"use client";

import clsx from "clsx";
import { AlertTriangle, Lightbulb, PlayCircle, Target } from "lucide-react";
import type { PublicLesson } from "@/lib/languages/lesson-check";
import type { Analogy } from "@/lib/languages/analogies";

export interface StudioExample { title: string; code: string; explanation: string; language: string | null; guessable: boolean }

/** The everyday analogy: one familiar thing, what matches what, and where it stops being true. */
function AnalogyCard({ a }: { a: Analogy }) {
  return (
    <section aria-labelledby="analogy-h" className="rounded-2xl border border-[var(--m-rule)] bg-[var(--m-ground)]/60 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 id="analogy-h" className="flex items-center gap-2 font-lp-display text-[19px] font-bold text-[var(--m-ink)]"><span aria-hidden className="text-[22px]">{a.icon}</span>Everyday analogy: {a.title}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{a.text}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--m-muted)]"><span className="font-bold text-[var(--m-ink)]">Where it stops being true: </span>{a.differs}</p>
        </div>
        <table className="w-full self-start overflow-hidden rounded-xl border border-[var(--m-rule)] bg-white text-left text-[13.5px]">
          <caption className="sr-only">What matches what</caption>
          <thead><tr className="bg-[var(--m-ground)] text-[11.5px] uppercase tracking-wide text-[var(--m-muted)]"><th scope="col" className="px-3 py-1.5">In daily life</th><th scope="col" className="px-3 py-1.5">In code</th></tr></thead>
          <tbody>{a.pairs.map(([everyday, code]) => <tr key={everyday} className="border-t border-[var(--m-rule)]"><td className="px-3 py-2 text-[var(--m-ink)]">{everyday}</td><td className="px-3 py-2 font-bold text-[var(--m-ink)]">{code}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * The centre of a lesson: the idea in simple words, an everyday analogy, a worked example to read, and the rest of the lesson in short pieces that open when wanted.
 * The first paragraph of every section is always visible; the rest sits behind "Read more".
 */
export function ConceptPanel({ title, minutes, lesson, analogy, examples, at, onPick, onPredict }: {
  title: string; minutes: number; lesson: PublicLesson; analogy: Analogy | null; examples: StudioExample[]; at: number; onPick: (i: number) => void; onPredict: () => void;
}) {
  const current = examples[at] ?? null;
  const exampleOf = (si: number) => lesson.sections.slice(0, si).filter((s) => s.example?.code).length;
  return (
    <div className="flex min-w-0 flex-col gap-5 rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-7">
      <header>
        <h1 className="text-balance font-lp-display text-[30px] font-bold leading-[1.06] tracking-tight text-[var(--m-ink)] sm:text-[38px]">{title}</h1>
        <p className="mt-1 text-[13px] font-bold text-[var(--m-muted)]">About {minutes} minutes</p>
        <p className="mt-3 max-w-[64ch] text-[16.5px] leading-relaxed text-[var(--m-ink)]">{lesson.summary}</p>
      </header>

      {analogy && <AnalogyCard a={analogy} />}

      {current && (
        <section aria-labelledby="action-h" className="rounded-2xl border border-[var(--m-rule)] p-4 sm:p-5">
          <h2 id="action-h" className="flex items-center gap-2 font-lp-display text-[19px] font-bold text-[var(--m-ink)]"><PlayCircle size={19} aria-hidden className="text-[#17784a]" />See it in action</h2>
          {examples.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Choose an example">
              {examples.map((e, i) => <button key={i} type="button" onClick={() => onPick(i)} aria-pressed={i === at} className={clsx("rounded-full px-3 py-1 text-[12.5px] font-bold", i === at ? "bg-[var(--m-ink)] text-white" : "bg-[var(--m-ground)] text-[var(--m-ink)]")}>{e.title}</button>)}
            </div>
          )}
          <p className="mt-2 text-[14px] text-[var(--m-muted)]">{current.title}. Read it line by line.</p>
          <pre className="ss-scroll mt-2 overflow-x-auto rounded-xl bg-[var(--m-ink)] p-4 font-lp-mono text-[13px] leading-relaxed text-white"><code>{current.code}</code></pre>
          <div className="mt-3 rounded-xl bg-[var(--m-ground)] p-4"><p className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">What happens</p><p className="mt-1 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{current.explanation}</p></div>
          {current.guessable && <button type="button" onClick={onPredict} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-4 py-2 text-[14px] font-bold text-white"><Target size={15} aria-hidden />Guess what it prints</button>}
        </section>
      )}

      <div className="flex flex-col gap-4">
        {lesson.sections.map((s, i) => (
          <section key={i} aria-labelledby={`cp-${i}`}>
            <h3 id={`cp-${i}`} className="font-lp-display text-[20px] font-bold leading-snug text-[var(--m-ink)]">{s.heading}</h3>
            <p className="mt-1 max-w-[66ch] text-[15.5px] leading-relaxed text-[var(--m-ink)]">{s.paragraphs[0]}</p>
            {s.paragraphs.length > 1 && (
              <details className="mt-1 max-w-[66ch]"><summary className="cursor-pointer text-[14px] font-bold text-[var(--m-accent-ink)]">Read more</summary>
                <div className="mt-2 flex flex-col gap-3">{s.paragraphs.slice(1).map((p, pi) => <p key={pi} className="text-[15px] leading-relaxed text-[var(--m-ink)]">{p}</p>)}</div></details>
            )}
            {s.example?.code && <button type="button" onClick={() => onPick(exampleOf(i))} className="mt-2 text-[13.5px] font-bold text-[var(--m-accent-ink)] underline">Show this example above</button>}
          </section>
        ))}
      </div>

      <section aria-labelledby="keys-h" className="rounded-2xl bg-[var(--m-ink)] p-5 text-white">
        <h2 id="keys-h" className="flex items-center gap-2 font-lp-display text-[19px] font-bold"><Lightbulb size={18} aria-hidden className="text-[var(--m-accent)]" />Remember this</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed marker:text-[var(--m-accent)]">{lesson.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>
      {lesson.mistakes.length > 0 && (
        <details className="rounded-2xl border border-[var(--m-rule)] p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-lp-display text-[18px] font-bold text-[var(--m-ink)]"><AlertTriangle size={17} aria-hidden />Common mistakes</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{lesson.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
