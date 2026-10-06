import type { loadCourseRelevance } from "@/lib/careers/data";
import { EmptyState } from "@/components/org/ui";
import { RelevancePill, WhyRelevant } from "./RelevanceBits";

type Data = Awaited<ReturnType<typeof loadCourseRelevance>>;

/** Derived from the course's CONFIRMED skills and each career's requirements — calculated, never typed in. */
export function CourseRelevance({ data }: { data: Data }) {
  if (!data.configured) return <EmptyState title="Career requirements aren't configured yet" body="Once careers and the skills they need are set up, this shows how strongly this course's confirmed skills match each career." />;
  if (data.confirmedSkills === 0) return <EmptyState title="Confirm this course's skills first" body="Career relevance is calculated from the skills you have confirmed for this course. Suggested skills don't count until you confirm them." />;
  return (
    <ul className="flex flex-col gap-2">
      {data.ranked.map((r) => (
        <li key={r.careerId} className="rounded-xl border border-app-border p-3">
          <details>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span className="font-lp-body text-[13px] font-semibold text-app-charcoal">{r.careerName}</span>
              <RelevancePill label={r.relevance.label} />
              <span className="ml-auto font-lp-mono text-[11px] text-app-muted">Why?</span>
            </summary>
            <WhyRelevant matches={r.relevance.matches} names={data.names} score={r.relevance.score} />
          </details>
        </li>
      ))}
    </ul>
  );
}
