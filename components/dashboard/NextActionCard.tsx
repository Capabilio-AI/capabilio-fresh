import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import type { NextAction } from "@/lib/dashboard/next-action";

export function NextActionCard({ action }: { action: NextAction | null }) {
  if (!action) {
    return (
      <div className="rounded-2xl border border-app-border bg-white p-6 text-center">
        <p className="font-lp-body text-[13.5px] text-app-muted">
          Complete your assessment to get a personalized next step.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-app-charcoal bg-app-charcoal p-6 text-white sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--m-soft)]">
            <Target size={14} />
            Next best action
          </div>
          <h2 className="mt-2 font-lp-display text-[22px] font-semibold sm:text-[26px]">Level up {action.skill}</h2>
          <p className="mt-2 max-w-xl font-lp-body text-[13.5px] leading-relaxed text-white/70">{action.why}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-lp-mono text-[11px] text-white/60">
            <span>
              Current <span className="font-semibold text-white">{action.currentLevel ?? "Unassessed"}</span>
            </span>
            <span>
              Target <span className="font-semibold text-white">{action.targetLevel}</span>
            </span>
            <span>
              Est. <span className="font-semibold text-white">{action.estimatedWeeks} weeks</span>
            </span>
            <span>
              For <span className="font-semibold text-white">{action.relatedCareer}</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href="/skillstudio"
            className="flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 font-lp-body text-[13.5px] font-bold text-[var(--m-ink)] transition-transform hover:-translate-y-0.5"
          >
            Start learning
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/dashboard/skills?view=gaps"
            className="text-center font-lp-mono text-[11px] text-white/60 hover:text-white hover:underline"
          >
            Why this?
          </Link>
        </div>
      </div>
    </div>
  );
}
