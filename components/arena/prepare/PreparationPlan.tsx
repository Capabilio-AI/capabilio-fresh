import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { PreparationView } from "@/lib/launchpad/prepare-server";
import { TYPICAL_TICKET_MINUTES } from "@/lib/launchpad/prepare";

const hours = (minutes: number) => (minutes < 60 ? `${minutes} minutes` : `about ${Math.round(minutes / 6) / 10} hours`);

/** The plan for one job: where the user stands, what to do about each gap, and about how long it takes. Pure, so it renders the same anywhere. */
export function PreparationPlan({ view }: { view: PreparationView }) {
  const { match, preparation: p } = view;
  const headline = match.percent === null ? "No match yet" : match.measured === 0 ? "No evidence yet" : `${match.percent}% match today`;
  return (
    <section aria-labelledby="plan-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-8">
      <h2 id="plan-h" className="font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">Your preparation for {view.title}</h2>
      <p className="mt-1 font-lp-display text-[18px] font-bold text-[var(--m-accent-ink)]">{headline}</p>
      <p className="mt-1 max-w-2xl font-lp-body text-[13.5px] leading-relaxed text-app-muted">
        The job lists {match.total} skill{match.total === 1 ? "" : "s"}. This plan compares each with what you have actually been measured on. It updates as you complete tickets.
      </p>

      {p.steps.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-[var(--m-ground)] px-4 py-5 font-lp-body text-[14px] text-[var(--m-ink)]">
          {p.ready.length > 0 ? "You already meet every skill we could compare. You are ready to apply." : "There is nothing to prepare for yet because none of the skills could be compared."}
        </p>
      ) : (
        <>
          <p className="mt-5 rounded-2xl bg-[var(--m-accent-soft)] px-4 py-3 font-lp-body text-[14px] font-semibold text-[var(--m-accent-ink)]">
            {p.totalTickets > 0
              ? `About ${p.totalTickets} Arena ticket${p.totalTickets === 1 ? "" : "s"}, roughly ${hours(p.totalMinutes)} of work (${TYPICAL_TICKET_MINUTES} minutes each). At one ticket a day that is about ${p.days} day${p.days === 1 ? "" : "s"}.`
              : "These skills are built in SkillStudio, so there is no ticket estimate."}
          </p>
          <ol className="mt-5 flex flex-col gap-3">
            {p.steps.map((s, i) => (
              <li key={s.skillId} className="flex items-start gap-4 rounded-2xl border border-[var(--m-rule)] p-4">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--m-ink)] font-lp-display text-[14px] font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-[var(--m-ink)]">{s.skill}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--m-muted)]">
                    {s.state === "unmeasured" ? "Not assessed yet" : `Level ${Math.round(s.level!)}`} · the job needs about {s.target}
                    {s.ticketsNeeded > 0 ? ` · about ${s.ticketsNeeded} ticket${s.ticketsNeeded === 1 ? "" : "s"}` : ""}
                  </p>
                  <Link href={s.action.href} className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--m-accent-ink)] hover:underline">
                    {s.action.kind === "arena" ? `Practise ${s.action.areaName} in Arena` : "Learn it in SkillStudio"} <ArrowRight size={13} aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {p.ready.length > 0 && (
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 font-lp-body text-[13px] text-[var(--m-muted)]">
          <Check size={14} className="text-app-success" aria-hidden />
          <span className="font-semibold text-[var(--m-ink)]">Already ready:</span> {p.ready.map((s) => `${s.text} (${Math.round(s.level!)})`).join(", ")}
        </p>
      )}
      {p.unmapped.length > 0 && (
        <p className="mt-2 font-lp-body text-[12.5px] text-[var(--m-muted)]">
          Not in our skill catalog yet, so not part of this plan: {p.unmapped.join(", ")}.
        </p>
      )}
    </section>
  );
}
