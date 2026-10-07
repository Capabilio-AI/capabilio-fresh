import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { staffBranchScope } from "@/lib/org/branch-scope";
import { listProjectsForStaff, listSubjects } from "@/lib/org/loaders";
import { JsonForm } from "@/components/org/JsonForm";
import { Collapsible, EmptyState, PageHeader, Panel, Pill, formatDateTime } from "@/components/org/ui";

export const metadata: Metadata = { title: "Projects — Capabilio AI" };

export default async function OrgProjectsPage() {
  const { ctx, service } = await orgPageContext("createProject");
  const scope = staffBranchScope(ctx);
  const [projects, subjects] = await Promise.all([listProjectsForStaff(service, ctx), listSubjects(service, ctx.institutionId, scope)]);

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
      <Panel title="Your projects">
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" body="Projects you post appear here with their groups and submissions." />
        ) : (
          <ul className="divide-y divide-app-border">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/org/projects/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-white/[0.03]">
                  <div>
                    <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{p.title}</p>
                    <p className="font-lp-mono text-[11px] text-app-muted">
                      Due {formatDateTime(p.deadline_at)} · {p.groupCount} group{p.groupCount === 1 ? "" : "s"} · {p.submitted} submitted · {p.graded} graded
                    </p>
                  </div>
                  <Pill tone={p.status === "open" ? "ok" : "neutral"}>{p.status}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
