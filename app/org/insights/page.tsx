import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { GOAL_KEYS, MIN_COHORT, loadInsights } from "@/lib/org/insights";
import { EmptyState, PageHeader } from "@/components/org/ui";
import { Fact, GroupTitle, Meter, StackBar } from "@/components/org/widgets";

export const metadata: Metadata = { title: "Insights — Capabilio AI" };

const GOAL_COLOR: Record<(typeof GOAL_KEYS)[number], string> = { job: "var(--app-success)", higher_studies: "var(--app-blue)", entrepreneur: "#e0a30c", not_sure: "#a39770", unset: "#d9cba3" };
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

      <section aria-label="Career intent by cohort">
        <GroupTitle count={cohorts.length}>Career intent by cohort</GroupTitle>
        {cohorts.length === 0 ? (
          <EmptyState title="No active students yet" body="Cohorts appear when students who signed up with your institution's name are active." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {cohorts.map((c) => (
              <li key={`${c.branch}-${c.endYear}`} className="o-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[14.5px] font-bold text-app-charcoal">{c.branch}</p>
                  <p className="shrink-0 text-[12.5px] text-app-muted">
                    Class of {c.endYear ?? "—"} · {c.size} students
                  </p>
                </div>
                {c.goals ? (
                  <div className="mt-3 flex flex-col gap-3">
                    <StackBar total={c.size} parts={GOAL_KEYS.filter((g) => c.goals![g] > 0).map((g) => ({ key: g, label: GOAL_LABEL[g], value: c.goals![g], color: GOAL_COLOR[g] }))} />
                    {c.projectParticipation !== null && (
                      <div>
                        <div className="mb-1 flex justify-between text-[12px] text-app-muted">
                          <span>In a project group</span>
                          <span className="font-bold text-app-charcoal">{Math.round(c.projectParticipation * 100)}%</span>
                        </div>
                        <Meter value={Math.round(c.projectParticipation * 100)} max={100} label="In a project group" />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-[12.5px] text-app-muted">Fewer than {MIN_COHORT} students, so the breakdown is hidden to protect privacy.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Projects and materials">
        <GroupTitle>Projects and materials</GroupTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Fact label="Projects posted" value={projects.projects} />
          <Fact label="Groups formed" value={projects.groups} />
          <Fact label="Submitted" value={pct(projects.submitted, projects.groups)} hint={`${projects.submitted} of ${projects.groups} groups`} />
          <Fact label="Graded" value={pct(projects.graded, projects.groups)} hint={`${projects.graded} of ${projects.groups} groups`} tone="text-app-success" />
        </div>
        <div className="o-card mt-3 p-4">
          <h3 className="text-[13px] font-bold text-app-charcoal">Grade distribution</h3>
          {projects.gradeDistribution ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {Object.entries(projects.gradeDistribution).map(([grade, count]) => (
                <li key={grade} className="rounded-full border border-app-border px-3 py-1 text-[12.5px] text-app-charcoal">
                  {grade}: <b>{count}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-app-muted">Shown once at least {MIN_COHORT} groups have been graded.</p>
          )}
          <h3 className="mt-4 text-[13px] font-bold text-app-charcoal">Materials published by branch</h3>
          {projects.materialsByBranch.length === 0 ? (
            <p className="mt-1 text-[12.5px] text-app-muted">No materials published yet. (Reading activity isn&apos;t tracked, so no engagement figure is shown.)</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {projects.materialsByBranch.map((m) => (
                <li key={m.branch} className="rounded-full border border-app-border px-3 py-1 text-[12.5px] text-app-charcoal">
                  {m.branch}: <b>{m.count}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
