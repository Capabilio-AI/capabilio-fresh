import Link from "next/link";
import type { CourseRow } from "@/lib/curriculum/admin-data";
import { Panel, Pill } from "@/components/org/ui";

/** Which courses have learning outcomes, units and lab work, and which still need a look. Editing happens on each course's page. */
export function OutcomesStep({ importId, courses }: { importId: string; courses: CourseRow[] }) {
  const without = courses.filter((c) => c.outcomes === 0);
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <p className="font-lp-body text-[13px] text-app-charcoal">{courses.length - without.length} of {courses.length} courses have learning outcomes.</p>
        <p className="mt-1 font-lp-body text-[12.5px] leading-relaxed text-app-muted">Outcomes, units, topics and lab experiments are what skills are suggested from — a course with none can still be mapped by hand. Open a course to read and correct what was extracted.</p>
      </Panel>
      <ul className="flex flex-col gap-2">
        {courses.map((c) => (
          <li key={c.id} className="o-card !rounded-xl flex flex-wrap items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{c.title}</p>
              <p className="font-lp-mono text-[11px] text-app-muted">Year {c.year}{c.semester ? ` · Semester ${c.semester}` : ""}</p>
            </div>
            <Pill tone={c.outcomes ? "ok" : "warn"}>{c.outcomes ? `${c.outcomes} outcomes` : "No outcomes"}</Pill>
            <Pill>{c.units} units</Pill>
            {c.experiments > 0 && <Pill>{c.experiments} experiments</Pill>}
            <Link href={`/org/curriculum/${importId}/courses/${c.id}`} className="o-btn-ghost !px-3 !py-1.5 !text-[12px]">{c.outcomes ? "Review" : "Add outcomes"}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
