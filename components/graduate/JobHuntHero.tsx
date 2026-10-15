import Link from "next/link";
import { ArrowRight, Check, Flag } from "lucide-react";
import { JOB_READY_AT, type Overview } from "@/lib/dashboard/overview";
import { currentStep, type PipelineStep } from "@/lib/graduate/pipeline";
import { planById } from "@/lib/plans/catalog";

/** Top of the graduate dashboard: who they are, how ready they are, and the four-station job hunt with the live one marked. */
export function JobHuntHero({ firstName, overview, steps, planId }: { firstName: string | null; overview: Overview | null; steps: PipelineStep[]; planId: string | null }) {
  const now = currentStep(steps);
  const plan = planById(planId);
  return (
    <section aria-labelledby="hunt-h" className="relative overflow-hidden rounded-3xl bg-[var(--m-ink)] p-6 text-white sm:p-8">
      <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--m-accent)] opacity-25 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-white/60">Recently graduated{plan ? ` · ${plan.name}` : ""}</p>
          <h1 id="hunt-h" className="mt-2 font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">
            {firstName ? `${firstName}, let's land your first role.` : "Let's land your first role."}
          </h1>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-white/70">
            {overview
              ? overview.pointsToGoal === 0
                ? `You are job-ready for ${overview.roleName}. Keep proving it and apply.`
                : `${overview.pointsToGoal} points to job-ready for ${overview.roleName}. Close the gap, then apply with proof.`
              : "Take the career assessment and your readiness, skill gaps and best-fit roles appear here."}
          </p>
        </div>
        {overview && (
          <div className="rounded-2xl bg-white/10 px-5 py-4 text-center backdrop-blur-sm">
            <p className="flex items-center justify-center gap-1.5 font-lp-mono text-[11px] uppercase tracking-wide text-white/60"><Flag size={12} aria-hidden />{overview.roleName}</p>
            <p className="mt-1 font-lp-display text-[42px] font-bold leading-none">{overview.readiness}<span className="text-[20px] text-white/60">%</span></p>
            <p className="mt-1 text-[11.5px] text-white/60">ready · job-ready at {JOB_READY_AT}%</p>
            <p className="mt-2 text-[12px] font-bold" style={{ color: overview.tier.color }}>{overview.tier.label} · {overview.elo} ELO</p>
          </div>
        )}
      </div>

      <ol className="relative mt-7 grid gap-2.5 sm:grid-cols-4" aria-label="Your job hunt">
        {steps.map((s, i) => {
          const live = now?.key === s.key;
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                aria-current={live ? "step" : undefined}
                className={`group flex h-full flex-col gap-1.5 rounded-2xl border p-4 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${live ? "border-[var(--m-accent)] bg-white text-[var(--m-ink)]" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
              >
                <span className="flex items-center justify-between">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-bold ${s.done ? "bg-[var(--m-accent)] text-white" : live ? "bg-[var(--m-ink)] text-white" : "border border-white/30 text-white/70"}`}>
                    {s.done ? <Check size={13} aria-hidden /> : i + 1}
                  </span>
                  {live && <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />}
                </span>
                <span className="font-lp-display text-[15.5px] font-bold leading-tight">{s.label}</span>
                <span className={`text-[12.5px] ${live ? "text-[var(--m-muted)]" : "text-white/60"}`}>{s.detail}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
