"use client";

import { useState } from "react";
import clsx from "clsx";
import { ConceptPanel, type StudioExample } from "./ConceptPanel";
import { ProvePanel, type Stage } from "./ProvePanel";
import { MasteryStrip } from "./MasteryStrip";
import type { RecordedAnswer } from "./types";
import type { PublicLesson } from "@/lib/languages/lesson-check";
import type { Analogy } from "@/lib/languages/analogies";
import type { StepState } from "@/lib/languages/step-proof";

/**
 * One lesson as a studio: the idea on the left (with an everyday analogy and a worked example), the proof on the right (Predict, Build, Prove), and the mastery strip
 * below. The step state is held here so the right side and the strip always agree, and it is only ever set from what the server answered.
 */
export function LessonStudio({ track, lessonKey, title, minutes, lesson, analogy, examples, initialStep, initialAnswers, next, moduleTest }: {
  track: string; lessonKey: string; title: string; minutes: number; lesson: PublicLesson; analogy: Analogy | null; examples: StudioExample[];
  initialStep: StepState; initialAnswers: Record<number, RecordedAnswer>; next: { href: string; title: string } | null; moduleTest: { href: string; moduleTitle: string } | null;
}) {
  const [step, setStep] = useState(initialStep);
  const [at, setAt] = useState(0);
  const [stage, setStage] = useState<Stage>(examples[0]?.guessable ? "predict" : "build");
  const [pane, setPane] = useState<"learn" | "prove">("learn");
  const tab = (id: "learn" | "prove", label: string) => <button type="button" role="tab" aria-selected={pane === id} onClick={() => setPane(id)} className={clsx("flex-1 rounded-lg py-2 text-[14px] font-bold", pane === id ? "bg-[var(--m-ink)] text-white" : "text-[var(--m-ink)]")}>{label}</button>;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="tablist" aria-label="Lesson halves" className="flex gap-1 rounded-xl border border-[var(--m-rule)] bg-white p-1 lg:hidden">{tab("learn", "Learn")}{tab("prove", "Prove it")}</div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className={clsx(pane !== "learn" && "hidden lg:block")}>
          <ConceptPanel title={title} minutes={minutes} lesson={lesson} analogy={analogy} examples={examples} at={at} onPick={setAt} onPredict={() => { setStage("predict"); setPane("prove"); }} />
        </div>
        <div className={clsx("xl:sticky xl:top-24", pane !== "prove" && "hidden lg:block")}>
          <ProvePanel track={track} lessonKey={lessonKey} lesson={lesson} example={examples[at] ?? null} step={step} onStep={setStep} stage={stage} onStage={setStage} initialAnswers={initialAnswers} />
        </div>
      </div>
      <MasteryStrip step={step} next={next} moduleTest={moduleTest} proveHref={step.challenge !== "none" ? `/arena/prove/${track}/${lessonKey}` : undefined} />
    </div>
  );
}
