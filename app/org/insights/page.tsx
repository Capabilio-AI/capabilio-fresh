import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { GOAL_KEYS, MIN_COHORT, loadInsights } from "@/lib/org/insights";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/org/ui";

export const metadata: Metadata = { title: "Insights — Capabilio AI" };

const GOAL_LABEL: Record<(typeof GOAL_KEYS)[number], string> = {
  job: "Job",
  higher_studies: "Higher studies",
  entrepreneur: "Entrepreneur",
  not_sure: "Not sure",
  unset: "Not answered",
};

export default async function InsightsPage() {
  const { ctx, service } = await orgPageContext("viewInsights");
  const { cohorts, projects } = await loadInsights(service, ctx.institutionId);
  const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Insights"
        subtitle={`Aggregates only. No individual student's work, grades or answers are shown here, and any group under ${MIN_COHORT} students is hidden. Every number is counted from real records.`}
      />

      <Panel title="Career intent by cohort">
        {cohorts.length === 0 ? (
          <EmptyState title="No active students yet" body="Cohorts appear when students who signed up with your institution's name are active." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left font-lp-body text-[13px]">
              <thead>
                <tr className="border-b border-app-border font-lp-mono text-[11px] uppercase text-app-muted">
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Class of</th>
                  <th className="py-2 pr-3">Students</th>
                  {GOAL_KEYS.map((g) => (
                    <th key={g} className="py-2 pr-3">{GOAL_LABEL[g]}</th>
                  ))}
                  <th className="py-2">In a project group</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={`${c.branch}-${c.endYear}`} className="border-b border-app-border/60 text-app-charcoal">
                    <td className="py-2 pr-3">{c.branch}</td>
                    <td className="py-2 pr-3">{c.endYear ?? "—"}</td>
                    <td className="py-2 pr-3">{c.size}</td>
                    {c.goals ? (
                      <>
                        {GOAL_KEYS.map((g) => (
                          <td key={g} className="py-2 pr-3">{c.goals![g]}</td>
                        ))}
                        <td className="py-2">{c.projectParticipation === null ? "—" : `${Math.round(c.projectParticipation * 100)}%`}</td>
                      </>
                    ) : (
                      <td colSpan={GOAL_KEYS.length + 1} className="py-2 text-app-muted">
                        Fewer than {MIN_COHORT} students — breakdown hidden to protect privacy.
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Projects & materials">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Projects posted" value={projects.projects} />
          <Stat label="Groups formed" value={projects.groups} />
          <Stat label="Submitted" value={pct(projects.submitted, projects.groups)} hint={`${projects.submitted} of ${projects.groups} groups`} />
          <Stat label="Graded" value={pct(projects.graded, projects.groups)} hint={`${projects.graded} of ${projects.groups} groups`} />
        </div>
        <div className="mt-5">
          <h3 className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">Grade distribution</h3>
          {projects.gradeDistribution ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {Object.entries(projects.gradeDistribution).map(([grade, count]) => (
                <li key={grade} className="rounded-full border border-app-border px-3 py-1 font-lp-body text-[12.5px] text-app-charcoal">
                  {grade}: {count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">Shown once at least {MIN_COHORT} groups have been graded.</p>
          )}
        </div>
        <div className="mt-5">
          <h3 className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">Materials published by branch</h3>
          {projects.materialsByBranch.length === 0 ? (
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">No materials published yet. (Reading activity isn&apos;t tracked, so no engagement figure is shown.)</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {projects.materialsByBranch.map((m) => (
                <li key={m.branch} className="rounded-full border border-app-border px-3 py-1 font-lp-body text-[12.5px] text-app-charcoal">
                  {m.branch}: {m.count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
