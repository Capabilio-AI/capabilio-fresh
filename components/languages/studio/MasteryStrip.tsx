import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, CircleDashed } from "lucide-react";
import clsx from "clsx";
import { stepMastery } from "@/lib/languages/mastery";
import type { StepState } from "@/lib/languages/step-proof";

/**
 * The strip along the bottom: how much of this step the learner has mastered, exactly what moves that number, and the way on. The next step opens only when the
 * server says this one is complete, so the button here is the same rule the server enforces, not a decoration.
 */
export function MasteryStrip({ step, next, moduleTest }: { step: StepState; next: { href: string; title: string } | null; moduleTest: { href: string; moduleTitle: string } | null }) {
  const m = stepMastery(step);
  const missing = [
    !step.checkDone ? `answer ${step.total - step.answered} more ${step.total - step.answered === 1 ? "question" : "questions"}` : null,
    step.challenge === "open" ? "pass the coding challenge" : null,
  ].filter((x): x is string => x !== null);
  return (
    <section aria-label="Your mastery of this step" className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-3xl border border-[var(--m-rule)] bg-white p-5">
      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]"><Award size={24} /></span>
      <div className="min-w-[220px] flex-1">
        <p className="font-lp-display text-[18px] font-bold leading-tight text-[var(--m-ink)]">{step.complete ? "Step complete. The next one is open." : "Finish this step to open the next one."}</p>
        <p className="text-[13.5px] text-[var(--m-muted)]">{step.complete ? "Keep going, then pass the module test to open the next module." : `To finish: ${missing.join(" and ")}.`}</p>
      </div>
      <div className="min-w-[170px]">
        <p className="ss-num text-[22px] font-bold leading-none text-[var(--m-ink)]">{m.pct}%<span className="ml-1.5 text-[12.5px] font-bold text-[var(--m-muted)]">mastery</span></p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${m.pct} percent mastery. ${m.basis}`}><div className="h-full rounded-full bg-[#17784a] transition-[width] motion-reduce:transition-none" style={{ width: `${m.pct}%` }} /></div>
        <p className="mt-1 text-[11.5px] text-[var(--m-muted)]">{m.basis}</p>
      </div>
      <ul className="flex flex-wrap gap-2 text-[13px] font-bold">
        {m.parts.map((p) => <li key={p.key} className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5", p.done ? "bg-[#e8f5ee] text-[#0f5132]" : "bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]")}>{p.done ? <CheckCircle2 size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />}{p.label}: {p.value}</li>)}
      </ul>
      {step.complete
        ? (moduleTest
          ? <Link href={moduleTest.href} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-accent)] px-5 py-2.5 text-[14.5px] font-bold text-white">Take the {moduleTest.moduleTitle} test<ArrowRight size={15} aria-hidden /></Link>
          : next && <Link href={next.href} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white">Next: {next.title}<ArrowRight size={15} aria-hidden /></Link>)
        : <span className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ground)] px-5 py-2.5 text-[14px] font-bold text-[var(--m-muted)]" aria-disabled="true">Next step is locked</span>}
    </section>
  );
}
