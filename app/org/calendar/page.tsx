import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { ALL_BRANCHES, ALL_YEARS, listCalendar } from "@/lib/org/academic-calendar";
import { loadStudentRows } from "@/lib/curriculum/cohorts";
import { branchKey } from "@/lib/org/branch-scope";
import { PageHeader, Panel, EmptyState } from "@/components/org/ui";
import { JsonForm } from "@/components/org/JsonForm";

export const metadata: Metadata = { title: "Academic calendar — Capabilio AI" };

const YEAR_OPTIONS = [{ value: String(ALL_YEARS), label: "All years" }, ...[1, 2, 3, 4].map((y) => ({ value: String(y), label: `Year ${y}` }))];
const yearLabel = (y: number) => (y === ALL_YEARS ? "All years" : `Year ${y}`);
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Staff set when each semester starts. Every student's current semester follows from these dates; students cannot set it themselves. */
export default async function OrgCalendarPage() {
  const { ctx, service } = await orgPageContext("manageCalendar");
  const [entries, students] = await Promise.all([listCalendar(service, ctx.institutionId), loadStudentRows(service, ctx.institutionId)]);
  const branches = [...new Map(students.filter((s) => branchKey(s.branch)).map((s) => [branchKey(s.branch), (s.branch as string).trim()])).values()].sort();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Academic calendar"
        subtitle={`${ctx.institutionName}. Enter when each semester starts and ends. Students' semester updates automatically from the start dates, so they never need to set it. Choose a branch and year, or all branches and all years; a specific row overrides an "all" row.`}
      />
      <Panel title="Set a semester's dates">
        <JsonForm
          action="/api/org/calendar"
          submitLabel="Save date"
          successMessage="Saved. Students' semesters now follow this date."
          resetOnSuccess={false}
          fields={[
            { name: "branch", label: "Branch", type: "select", required: true, options: [{ value: ALL_BRANCHES, label: "All branches" }, ...branches.map((b) => ({ value: b, label: b }))] },
            { name: "yearOfStudy", label: "Year of study", type: "select", required: true, options: YEAR_OPTIONS },
            { name: "semester", label: "Semester", type: "select", required: true, options: [{ value: "1", label: "Semester 1" }, { value: "2", label: "Semester 2" }] },
            { name: "startsOn", label: "Starts on", type: "date", required: true },
            { name: "endsOn", label: "Ends on", type: "date", required: true },
          ]}
        />
      </Panel>
      <Panel title="Dates on file">
        {entries.length === 0 ? (
          <EmptyState title="No dates yet" body="Until you add dates, students see an estimate based on the college's usual start month." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-lp-body text-[13px]">
              <thead className="text-app-muted"><tr><th className="py-2 pr-4 font-medium">Branch</th><th className="py-2 pr-4 font-medium">Year</th><th className="py-2 pr-4 font-medium">Semester</th><th className="py-2 pr-4 font-medium">Starts</th><th className="py-2 font-medium">Ends</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-app-border">
                    <td className="py-2 pr-4">{e.branch}</td><td className="py-2 pr-4">{yearLabel(e.yearOfStudy)}</td><td className="py-2 pr-4">{e.semester}</td><td className="py-2 pr-4">{dateLabel(e.startsOn)}</td><td className="py-2">{dateLabel(e.endsOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
