"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, ClipboardCheck } from "lucide-react";
import { BuildChallenge } from "@/components/languages/studio/BuildChallenge";
import type { StepState } from "@/lib/languages/step-proof";

const REDIRECT_SECONDS = 5;

/**
 * The Arena side of a course step: the coding challenge on the Arena judge. The server records the pass; when that finishes the step, this sends the learner on to the
 * next step in SkillStudio. A step whose questions are not answered yet is sent back to its lesson to finish them.
 */
export function CourseProof({ track, lessonKey, initialStep, lessonHref, onward }: {
  track: string; lessonKey: string; initialStep: StepState; lessonHref: string; onward: { href: string; label: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [left, setLeft] = useState<number | null>(null);
  const target = step.complete ? onward : { href: lessonHref, label: "Back to the lesson to answer the questions" };

  const counting = left !== null;
  useEffect(() => {
    if (!counting) return;
    const tick = setInterval(() => setLeft((n) => (n === null ? n : Math.max(n - 1, 0))), 1000);
    return () => clearInterval(tick);
  }, [counting]);
  useEffect(() => { if (left === 0) router.push(onward.href); }, [left, onward.href, router]);

  // a pass that finishes the step starts the countdown to the next one; a step that was already finished on arrival just offers the button
  function onStep(next: StepState) {
    setStep(next);
    if (next.complete && !initialStep.complete) setLeft((n) => n ?? REDIRECT_SECONDS);
  }

  return (
    <div className="flex flex-col gap-5">
      {step.challenge === "passed" && (
        <section role="status" aria-label="Proof recorded" className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[#17784a] bg-[#e8f5ee] p-5 text-[#0f5132]">
          <BadgeCheck size={30} aria-hidden className="shrink-0" />
          <div className="min-w-[220px] flex-1">
            <p className="font-lp-display text-[20px] font-bold leading-tight">{step.complete ? "Step proven. It now counts as a proven skill." : "Coding challenge proven."}</p>
            <p className="mt-0.5 text-[14px]">{step.complete ? (left !== null ? `Taking you to the next step in ${Math.max(left, 0)}…` : "Everything for this step is done.") : "One part left: answer the lesson&apos;s questions to finish this step."}</p>
          </div>
          <Link href={target.href} className="inline-flex items-center gap-2 rounded-xl bg-[#0f5132] px-5 py-2.5 text-[14.5px] font-bold text-white">{step.complete ? onward.label : "Finish the questions"}<ArrowRight size={15} aria-hidden /></Link>
        </section>
      )}
      {step.challenge !== "passed" && !step.checkDone && (
        <p className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-[13.5px] text-white/80"><ClipboardCheck size={16} aria-hidden />The step finishes when this challenge is passed and the lesson&apos;s questions are answered. <Link href={lessonHref} className="font-bold text-white underline">Open the lesson</Link></p>
      )}
      <div className="rounded-3xl bg-white p-5 sm:p-6 text-[var(--m-ink)]">
        <BuildChallenge track={track} lessonKey={lessonKey} step={step} onStep={onStep} />
      </div>
    </div>
  );
}
