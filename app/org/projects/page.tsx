import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { staffBranchScope } from "@/lib/org/branch-scope";
import { listProjectsForStaff, listSubjects } from "@/lib/org/loaders";
import { JsonForm } from "@/components/org/JsonForm";
import { Collapsible, EmptyState, PageHeader, Pill, formatDateTime } from "@/components/org/ui";
import { GroupTitle, Meter } from "@/components/org/widgets";

export const metadata: Metadata = { title: "Projects — Capabilio AI" };

export default async function OrgProjectsPage() {
  const { ctx, service } = await orgPageContext("createProject");
  const scope = staffBranchScope(ctx);
  const [projects, subjects] = await Promise.all([listProjectsForStaff(service, ctx), listSubjects(service, ctx.institutionId, scope)]);

  const now = new Date().getTime();
  const needsGrading = projects.filter((p) => p.submitted > p.graded);
  const open = projects.filter((p) => p.status === "open" && p.submitted <= p.graded);
  const done = projects.filter((p) => p.status !== "open" && p.submitted <= p.graded);
  const lanes = [
    { title: "Needs grading", items: needsGrading },
    { title: "Open", items: open },
    { title: "Closed", items: done },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        subtitle={scope ? `Post a project brief for ${scope}. Only ${scope} students see it, in Arena, and form groups of four themselves. Only your final grade becomes evidence on each member's Portfolio.` : "Post a project brief. Students form groups of four themselves, across departments unless you restrict it. Only your final grade becomes evidence on each member's Portfolio."}
      />
      <Collapsible title="New project">
        <JsonForm
          action="/api/org/projects"
          submitLabel="Post project"
          successMessage="Project posted."
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "brief", label: "Brief", type: "textarea", required: true },
            { name: "submissionType", label: "Submission", type: "select", required: true, defaultValue: "in_app", options: [{ value: "in_app", label: "In app (link)" }, { value: "physical", label: "Physical (staff marks received)" }] },
            { name: "deadlineAt", label: "Deadline", type: "datetime-local", required: true },
            { name: "subjectId", label: "Subject (optional)", type: "select", options: subjects.map((s) => ({ value: s.id, label: s.label })) },
            ...(scope ? [] : [{ name: "departmentScope", label: "Restrict to branches (optional)", type: "list" as const, help: "Comma-separated, e.g. CSE, ECE. Leave empty to open to every department." }]),
            { name: "weeklyReportRequired", label: "Groups file weekly reports", type: "checkbox", defaultValue: true },
          ]}
        />
      </Collapsible>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" body="Projects you post appear here with their groups and submissions." />
      ) : (
        lanes.map((lane) =>
          lane.items.length === 0 ? null : (
            <section key={lane.title} aria-label={lane.title}>
              <GroupTitle count={lane.items.length}>{lane.title}</GroupTitle>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {lane.items.map((p) => {
                  const days = Math.ceil((new Date(p.deadline_at).getTime() - now) / 86_400_000);
                  return (
                    <li key={p.id}>
                      <Link href={`/org/projects/${p.id}`} className="o-card block p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[14.5px] font-bold text-app-charcoal">{p.title}</p>
                          <Pill tone={p.status !== "open" ? "neutral" : days < 0 ? "bad" : days <= 3 ? "warn" : "ok"}>{p.status !== "open" ? p.status : days < 0 ? "Past due" : days === 0 ? "Due today" : `${days}d left`}</Pill>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-app-muted">Due {formatDateTime(p.deadline_at)}</p>
                        <div className="mt-3 flex flex-col gap-2 text-[12px] text-app-muted">
                          <div>
                            <div className="mb-1 flex justify-between"><span>Submitted</span><span className="font-bold text-app-charcoal">{p.submitted} of {p.groupCount}</span></div>
                            <Meter value={p.submitted} max={p.groupCount} label="Groups submitted" />
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between"><span>Graded</span><span className="font-bold text-app-charcoal">{p.graded} of {p.groupCount}</span></div>
                            <Meter value={p.graded} max={p.groupCount} label="Groups graded" tone="ok" />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )
        )
      )}
    </div>
  );
}
