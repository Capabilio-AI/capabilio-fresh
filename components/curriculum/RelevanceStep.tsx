import Link from "next/link";
import type { loadImportRelevance } from "@/lib/careers/data";
import { EmptyState, Panel } from "@/components/org/ui";
import { RelevancePill, WhyRelevant } from "./RelevanceBits";

type Data = Awaited<ReturnType<typeof loadImportRelevance>>;
const TOP = 6;

/** For each career, which of this curriculum's courses serve it best — derived from confirmed skills only, so confirm your mappings first. */
export function RelevanceStep({ importId, data }: { importId: string; data: Data }) {
  if (!data.configured) {
    return <Panel><EmptyState title="Career requirements aren't configured yet" body="Once careers and the skills each one needs are set up, every course shows how strongly its confirmed skills match each career. You can continue without this step." /></Panel>;
  }
  if (data.coursesWithConfirmedSkills === 0) {
    return <Panel><EmptyState title="Nothing to calculate yet" body="Career relevance comes from the skills you've confirmed. Confirm skill mappings in the previous step and it will appear here." /></Panel>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <p className="font-lp-body text-[13px] text-app-charcoal">{data.coursesWithConfirmedSkills} course{data.coursesWithConfirmedSkills === 1 ? " has" : "s have"} confirmed skills, so {data.coursesWithConfirmedSkills === 1 ? "it counts" : "they count"} here.</p>
        <p className="mt-1 font-lp-body text-[12.5px] leading-relaxed text-app-muted">Relevance is calculated, not typed in: how much of a career&apos;s weighted skill demand a course covers. It never changes what students are told to study — every course stays part of the academic curriculum.</p>
      </Panel>
      {data.careers.map(({ career, ranked }) => (
        <section key={career.id} className="o-card p-5" aria-label={career.name}>
          <h3 className="font-lp-display text-[15px] font-semibold text-app-charcoal">{career.name}</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {ranked.filter((r) => r.relevance.label !== "NONE").slice(0, TOP).map((r) => (
              <li key={r.courseId} className="rounded-xl border border-app-border p-3">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <Link href={`/org/curriculum/${importId}/courses/${r.courseId}`} className="font-lp-body text-[13px] font-medium text-app-charcoal hover:underline">{r.title}</Link>
                    <span className="font-lp-mono text-[11px] text-app-muted">Year {r.year}</span>
                    <RelevancePill label={r.relevance.label} />
                    <span className="ml-auto font-lp-mono text-[11px] text-app-muted">Why?</span>
                  </summary>
                  <WhyRelevant matches={r.relevance.matches} names={data.names} score={r.relevance.score} />
                </details>
              </li>
            ))}
            {ranked.every((r) => r.relevance.label === "NONE") && <li className="font-lp-body text-[12.5px] text-app-muted">No course in this curriculum has confirmed skills that match this career.</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}
