import clsx from "clsx";
import { fmtExperience } from "@/lib/professional/experience";
import type { WorkEntry } from "@/lib/professional/work";
import { TierPill } from "@/components/professional/onboarding/shared";

/**
 * A professional's career drawn as a line: one station per job, the current job lit, newest first. Solid track means a job EPFO has checked;
 * dashed means the person has told us and it is not checked yet.
 */
export function CareerTimeline({ work, months }: { work: WorkEntry[]; months: number }) {
  if (work.length === 0) return <p className="text-[14.5px] text-[var(--m-muted)]">No jobs yet. Upload your resume or add a job on your profile and your timeline appears here.</p>;
  return (
    <div>
      <p className="text-[14px] text-[var(--m-muted)]"><span className="font-bold text-[var(--m-ink)]">{months > 0 ? fmtExperience(months) : "Experience not dated yet"}</span>{months > 0 ? " across " : ""}{months > 0 && `${work.length} ${work.length === 1 ? "job" : "jobs"}`}, as you have told us.</p>
      <ol aria-label="Career timeline, newest first" className="mt-4">
        {work.map((w, i) => {
          const last = i === work.length - 1;
          return (
            <li key={w.id} className="relative pl-9">
              {!last && <span aria-hidden className="absolute bottom-0 left-[8px] top-5 w-[3px] bg-[repeating-linear-gradient(to_bottom,var(--m-off)_0_5px,transparent_5px_9px)]" />}
              <span aria-hidden className={clsx("absolute left-0 top-1.5 size-[19px] rounded-full border-[3px] bg-white", w.current ? "border-[var(--m-accent)] shadow-[0_0_0_5px_var(--m-accent-soft)]" : "border-dashed border-[var(--m-muted)]")} />
              <div className={clsx("pb-6", last && "pb-0")}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold leading-snug text-[var(--m-ink)]">{w.title}</h3>
                    <p className="text-[14px] text-[var(--m-ink)]">{w.organisation}{w.current && <span className="ml-2 rounded-full bg-[var(--m-accent-soft)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--m-accent-ink)]">Current</span>}</p>
                    <p className="text-[13px] tabular-nums text-[var(--m-muted)]">{w.period}</p>
                  </div>
                  <TierPill tier="self_claimed" />
                </div>
                {w.description && <p className="mt-2 max-w-[66ch] text-[14px] leading-relaxed text-[var(--m-muted)]">{w.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
