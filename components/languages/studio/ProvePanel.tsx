"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckCircle2, ClipboardCheck, Code2, Target } from "lucide-react";
import { CheckYourself, type Verdict } from "@/components/skillstudio/learn/CheckYourself";
import { GuessBox } from "@/components/languages/GuessBox";
import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import type { StudioExample } from "./ConceptPanel";
import type { RecordedAnswer } from "./types";
import type { PublicLesson } from "@/lib/languages/lesson-check";
import type { StepState } from "@/lib/languages/step-proof";

export type Stage = "predict" | "build" | "prove";

/**
 * The right half: prove you understood, in three parts. Predict (guess what the code prints), Build (a live coding challenge with a problem statement), and Prove (the
 * questions). The step is finished only when the server has recorded the answers and the coding challenge pass; this panel only shows where that stands.
 */
export function ProvePanel({ track, lessonKey, lesson, example, step, onStep, stage, onStage, initialAnswers }: {
  track: string; lessonKey: string; lesson: PublicLesson; example: StudioExample | null; step: StepState; onStep: (s: StepState) => void; stage: Stage; onStage: (s: Stage) => void; initialAnswers: Record<number, RecordedAnswer>;
}) {
  const [predicted, setPredicted] = useState(false);

  async function grade(questionIndex: number, optionIndex: number): Promise<Verdict> {
    const res = await fetch("/api/languages/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ track, lessonKey, index: questionIndex, choice: optionIndex }) });
    if (!res.ok) throw new Error(`check failed: ${res.status}`);
    const body = (await res.json()) as Verdict & { step?: StepState };
    if (body.step) onStep(body.step);
    return { correct: body.correct, answerIndex: body.answerIndex, why: body.why };
  }

  const tabs: { id: Stage; label: string; Icon: typeof Target; done: boolean }[] = [
    { id: "predict", label: "Predict", Icon: Target, done: predicted },
    { id: "build", label: "Arena", Icon: Code2, done: step.challenge === "passed" },
    { id: "prove", label: "Prove", Icon: ClipboardCheck, done: step.checkDone },
  ];
  const doneCount = tabs.filter((t) => t.done).length;

  return (
    <section aria-labelledby="prove-h" className="flex min-w-0 flex-col gap-4 rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div><h2 id="prove-h" className="flex items-center gap-2 font-lp-display text-[24px] font-bold text-[var(--m-ink)]"><CheckCircle2 size={22} aria-hidden className="text-[#17784a]" />Prove you understand</h2><p className="mt-0.5 text-[14px] text-[var(--m-muted)]">Do all three to finish this step.</p></div>
        <p className="ss-num shrink-0 text-[13px] font-bold text-[var(--m-muted)]" aria-label={`${doneCount} of 3 parts done`}>{doneCount} of 3<span className="mt-1 flex justify-end gap-1.5" aria-hidden>{tabs.map((t) => <span key={t.id} className={clsx("h-2 w-2 rounded-full", t.done ? "bg-[#17784a]" : "bg-[var(--m-rule)]")} />)}</span></p>
      </div>

      <div role="tablist" aria-label="Parts of this step" className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--m-ground)] p-1">
        {tabs.map(({ id, label, Icon, done }) => (
          <button key={id} type="button" role="tab" aria-selected={stage === id} onClick={() => onStage(id)} className={clsx("inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[14px] font-bold", stage === id ? "bg-[var(--m-ink)] text-white" : "text-[var(--m-ink)]")}>
            <Icon size={15} aria-hidden />{label}{done && <span aria-label="done" className="text-[11px]">✓</span>}
          </button>
        ))}
      </div>

      {stage === "predict" && (example?.guessable && example.language
        ? <GuessBox key={example.title} code={example.code} language={example.language} title={example.title} onChange={() => onStage("build")} onChecked={() => setPredicted(true)} />
        : <p className="rounded-xl bg-[var(--m-ground)] p-4 text-[14.5px] text-[var(--m-ink)]">There is no example to guess for this step. Go to <button type="button" onClick={() => onStage("build")} className="font-bold underline">Build</button>.</p>)}
      {stage === "build" && <ArenaLaunch href={`/arena/prove/${track}/${lessonKey}`} challenge={step.challenge} />}
      {stage === "prove" && (
        <div className="-mx-1">
          <CheckYourself id="step-check" questions={lesson.check} grade={grade} initial={initialAnswers} proveHref={step.challenge !== "none" ? `/arena/prove/${track}/${lessonKey}` : undefined} />
        </div>
      )}
    </section>
  );
}

/** The coding proof of a step lives in Arena, on the same judge as the Arena challenges. This card is the way there and shows where the step stands. */
function ArenaLaunch({ href, challenge }: { href: string; challenge: StepState["challenge"] }) {
  if (challenge === "none") return <p className="rounded-xl bg-[var(--m-ground)] p-4 text-[14.5px] text-[var(--m-ink)]">This step has no coding challenge. The questions finish it.</p>;
  const passed = challenge === "passed";
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--m-ground)] p-5">
      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--m-ink)] text-white"><Swords size={22} /></span>
      <p className="font-lp-display text-[19px] font-bold leading-tight text-[var(--m-ink)]">{passed ? "Proven in Arena. Nice work." : "Prove this step with code in Arena"}</p>
      <p className="text-[14px] leading-relaxed text-[var(--m-muted)]">{passed ? "Your pass is recorded. You can open the challenge again any time." : "You get a real problem, an editor and a judge with hidden tests. When you pass, this step counts as a proven skill and the next one opens."}</p>
      <Link href={href} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white">{passed ? "Open the challenge" : "Open the Arena challenge"}<ArrowRight size={15} aria-hidden /></Link>
    </div>
  );
}
