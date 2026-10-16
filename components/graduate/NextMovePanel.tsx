import Link from "next/link";
import { ArrowRight, MessagesSquare, Rocket, Target } from "lucide-react";
import { BadgeArt } from "@/components/passport/badge/BadgeArt";
import type { Move } from "@/lib/graduate/next-move";
import { currentStep, type PipelineStep } from "@/lib/graduate/pipeline";

const ICON = { assess: Target, interview: MessagesSquare, apply: Rocket } as const;

/**
 * The one thing to do next, chosen from real state. When the move is about proving a skill, the badge being unlocked sits beside it as a ghost
 * with the progress made so far, so the reward is visible before the work starts.
 */
export function NextMovePanel({ move, steps }: { move: Move; steps: PipelineStep[] }) {
  const step = currentStep(steps);
  const position = step ? steps.findIndex((s) => s.key === step.key) + 1 : steps.length;
  const Icon = ICON[move.key as keyof typeof ICON];
  return (
    <section aria-labelledby="move-h" className="relative flex flex-col justify-between gap-8 overflow-hidden rounded-3xl bg-[var(--m-ink)] p-6 text-white sm:flex-row sm:items-center sm:p-8">
      <div className="min-w-0 sm:max-w-[34rem]">
        <p className="font-lp-body text-[13px] font-semibold text-white/60">{step ? `Step ${position} of ${steps.length}: ${step.label}` : "Every step is done. Keep your proof fresh."}</p>
        <h2 id="move-h" className="mt-2 font-lp-display text-[32px] font-bold leading-[1.05] tracking-tight [text-wrap:balance] sm:text-[38px]">{move.title}</h2>
        <p className="mt-3 max-w-[52ch] font-lp-body text-[15px] leading-relaxed text-white/75">{move.body}</p>
        <Link href={move.cta.href} className="group mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--m-accent)] px-6 py-3 font-lp-body text-[15px] font-bold text-[var(--m-ink)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgb(255_87_1/0.7)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          {move.cta.label}
          <ArrowRight size={17} aria-hidden className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
        </Link>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2 sm:pr-4" aria-hidden={!move.unlock}>
        {move.unlock ? (
          <>
            <div className="rounded-[36px] bg-white/[0.06] p-5 ring-1 ring-white/10"><BadgeArt skillId={move.unlock.skillId} name={move.unlock.name} level={null} size={132} progress={move.unlock.progress} /></div>
            <p className="font-lp-body text-[12.5px] font-semibold text-white/70">Badge to unlock: {move.unlock.name}</p>
          </>
        ) : Icon ? (
          <div className="grid h-[132px] w-[132px] place-items-center rounded-[36px] bg-white/[0.06] ring-1 ring-white/10"><Icon size={52} strokeWidth={1.4} className="text-[var(--m-accent)]" aria-hidden /></div>
        ) : null}
      </div>
    </section>
  );
}
