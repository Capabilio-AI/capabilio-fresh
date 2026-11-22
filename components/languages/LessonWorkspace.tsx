"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, ArrowRight, CircleCheck, Lightbulb, Play, TriangleAlert } from "lucide-react";
import type { PublicLesson } from "@/lib/languages/lesson-check";
import { Playground } from "@/components/skillstudio/learn/Playground";
import { CheckYourself, type Verdict } from "@/components/skillstudio/learn/CheckYourself";
import { Practice } from "@/components/skillstudio/learn/Practice";
import { exampleLanguage } from "@/lib/languages/playground-language";

type Saved = "idle" | "saving" | "saved" | "failed";
type Step = { href: string; title: string } | null;

interface Example { title: string; code: string }

/**
 * A lesson in two halves, the way a student works: the idea and its worked examples on the left, a live editor on the right that holds whichever example
 * they chose to try. Finishing the check questions records the lesson. On a phone the halves are two tabs. The last lesson of a module points to its test.
 */
export function LessonWorkspace({ track, trackTitle, lessonKey, lesson, alreadyDone, prev, next, moduleTest }: {
  track: string;
  trackTitle: string;
  lessonKey: string;
  /** the lesson without its check answers: the server marks those (app/api/languages/check) */
  lesson: PublicLesson;
  alreadyDone: boolean;
  prev: Step;
  next: Step;
  /** set on the last lesson of a module: where its test is, and whether the other lessons of the module are done */
  moduleTest: { href: string; moduleTitle: string; othersDone: boolean } | null;
}) {
  const [saved, setSaved] = useState<Saved>(alreadyDone ? "saved" : "idle");
  const [pane, setPane] = useState<"learn" | "try">("learn");
  const examples: Example[] = lesson.sections.flatMap((s) => (s.example?.code ? [{ title: s.example.title, code: s.example.code }] : []));
  const [at, setAt] = useState(0);
  const current = examples[at] ?? null;
  const language = current ? exampleLanguage(track, current.code) : null;

  async function onCheckDone(correct: number, total: number) {
    setSaved("saving");
    try {
      const res = await fetch("/api/languages/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ track, lessonKey, correct, total }) });
      setSaved(res.ok ? "saved" : "failed");
    } catch { setSaved("failed"); }
  }

  async function gradeOnServer(questionIndex: number, optionIndex: number): Promise<Verdict> {
    const res = await fetch("/api/languages/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ track, lessonKey, index: questionIndex, choice: optionIndex }) });
    if (!res.ok) throw new Error(`check failed: ${res.status}`);
    return (await res.json()) as Verdict;
  }

  const tryIt = (i: number) => { setAt(i); setPane("try"); };
  const tab = (id: "learn" | "try", label: string) => (
    <button type="button" role="tab" aria-selected={pane === id} onClick={() => setPane(id)} className={clsx("flex-1 rounded-lg py-2 text-[14px] font-bold", pane === id ? "bg-[var(--m-ink)] text-white" : "text-[var(--m-ink)]")}>{label}</button>
  );
  // the position of each section's example among the lesson's runnable examples, or -1 when it has none
  const exampleAt = lesson.sections.map((s, i) => (s.example?.code ? lesson.sections.slice(0, i).filter((x) => x.example?.code).length : -1));

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Lesson halves" className="flex gap-1 rounded-xl border border-[var(--m-rule)] bg-white p-1 lg:hidden">{tab("learn", "Learn")}{tab("try", "Try it yourself")}</div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <article className={clsx("flex min-w-0 flex-col gap-6", pane !== "learn" && "hidden lg:flex")}>
          <p className="max-w-[64ch] text-[17px] leading-relaxed text-[var(--m-ink)]">{lesson.summary}</p>
          {lesson.sections.map((s, i) => {
            const mine = exampleAt[i];
            const hasExample = mine >= 0;
            return (
              <section key={i} aria-labelledby={`lw-${i}`} className="flex flex-col gap-3">
                <h3 id={`lw-${i}`} className="font-lp-display text-[22px] font-bold leading-snug text-[var(--m-ink)]">{s.heading}</h3>
                {s.paragraphs.map((p, pi) => <p key={pi} className="max-w-[68ch] text-[15.5px] leading-relaxed text-[var(--m-ink)]">{p}</p>)}
                {s.example && (
                  <figure className={clsx("overflow-hidden rounded-xl border bg-[var(--m-ground)]", hasExample && mine === at ? "border-[var(--m-accent)]" : "border-[var(--m-rule)]")}>
                    <figcaption className="flex items-center justify-between gap-3 px-4 pt-3 text-[14px] font-bold text-[var(--m-ink)]"><span>{s.example.title}</span>
                      {hasExample && <button type="button" onClick={() => tryIt(mine)} className="inline-flex items-center gap-1.5 rounded-full bg-[#17784a] px-3 py-1 text-[12.5px] font-bold text-white"><Play size={12} aria-hidden />Try it</button>}
                    </figcaption>
                    {s.example.code && <pre className="ss-scroll mx-4 mt-2 overflow-x-auto rounded-lg bg-[var(--m-ink)] p-4 font-lp-mono text-[13px] leading-relaxed text-white"><code>{s.example.code}</code></pre>}
                    <p className="px-4 pb-4 pt-2 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{s.example.explanation}</p>
                  </figure>
                )}
              </section>
            );
          })}
          <section aria-labelledby="lw-keys" className="rounded-2xl bg-[var(--m-ink)] p-5 text-white">
            <h3 id="lw-keys" className="flex items-center gap-2 font-lp-display text-[20px] font-bold"><Lightbulb size={18} aria-hidden className="text-[var(--m-accent)]" />Remember this</h3>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed marker:text-[var(--m-accent)]">{lesson.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
          {lesson.mistakes.length > 0 && (
            <section aria-labelledby="lw-mistakes" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
              <h3 id="lw-mistakes" className="flex items-center gap-2 font-lp-display text-[20px] font-bold text-[var(--m-ink)]"><AlertTriangle size={18} aria-hidden />Common mistakes</h3>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-[var(--m-ink)]">{lesson.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </section>
          )}
          <CheckYourself id="theory-check" questions={lesson.check} onDone={onCheckDone} grade={gradeOnServer} />
          <p role="status" className="flex items-center gap-2 text-[14px] text-[var(--m-muted)]">
            {saved === "saved" && <><CircleCheck size={16} aria-hidden className="text-[#17784a]" />Lesson complete and saved.</>}
            {saved === "saving" && "Saving your progress…"}
            {saved === "failed" && <><TriangleAlert size={16} aria-hidden />Could not save your progress. Reload this page and answer the check again.</>}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {prev ? <Link href={prev.href} className="inline-flex items-center gap-2 rounded-full border border-[var(--m-rule)] bg-white px-5 py-2.5 text-[14.5px] font-bold text-[var(--m-ink)]"><ArrowLeft size={15} aria-hidden />Previous</Link> : <span />}
            {moduleTest ? (
              saved === "saved" && moduleTest.othersDone
                ? <Link href={moduleTest.href} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-accent)] px-5 py-2.5 text-[14.5px] font-bold text-white">Take the {moduleTest.moduleTitle} test<ArrowRight size={15} aria-hidden /></Link>
                : <span className="text-[13.5px] text-[var(--m-muted)]">Finish every lesson of this module to open its test.</span>
            ) : next && <Link href={next.href} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white">Next: {next.title}<ArrowRight size={15} aria-hidden /></Link>}
          </div>
        </article>

        <aside aria-label="Try it yourself" className={clsx("flex min-w-0 flex-col gap-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto", pane !== "try" && "hidden lg:flex")}>
          <div className="rounded-2xl border border-[var(--m-rule)] bg-white py-4">
            <div className="flex flex-wrap items-center gap-2 px-4">
              <h3 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Try it yourself</h3>
              {examples.length > 1 && <div className="ml-auto flex gap-1" role="group" aria-label="Choose an example">{examples.map((e, i) => <button key={i} type="button" onClick={() => setAt(i)} aria-pressed={i === at} title={e.title} className={clsx("ss-num h-7 w-7 rounded-md border text-[12.5px] font-bold", i === at ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-rule)] text-[var(--m-ink)]")}>{i + 1}</button>)}</div>}
            </div>
            {current ? (
              <>
                <p className="px-4 pt-1 text-[13.5px] text-[var(--m-muted)]">{current.title}. Change anything and run it to see what happens.</p>
                {language
                  ? <Playground key={`${lessonKey}-${at}`} code={current.code} language={language} title={current.title} stacked />
                  : <div className="mx-4 mt-2"><pre className="ss-scroll overflow-x-auto rounded-lg bg-[var(--m-ink)] p-4 font-lp-mono text-[13px] leading-relaxed text-white"><code>{current.code}</code></pre><p className="mt-2 text-[13px] text-[var(--m-muted)]">This language does not run in the page yet. Run it on your own computer with the .NET SDK, then take the module test.</p></div>}
              </>
            ) : <p className="px-4 pt-2 text-[14px] text-[var(--m-muted)]">This lesson has no code to run. Answer the questions to finish it.</p>}
          </div>
          <Practice source={{ track, lessonKey }} />
          <p className="px-1 text-[12.5px] text-[var(--m-muted)]">{trackTitle}: edit the example, break it on purpose, and run it again. That is how it sticks.</p>
        </aside>
      </div>
    </div>
  );
}
