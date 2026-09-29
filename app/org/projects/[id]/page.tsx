import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { orgPageContext } from "@/lib/org/page";
import { loadManagedProject } from "@/lib/org/project-access";
import { loadProjectGroups } from "@/lib/org/loaders";
import { ActionButton } from "@/components/org/ActionButton";
import { JsonForm } from "@/components/org/JsonForm";
import { EmptyState, PageHeader, Panel, Pill, formatDateTime } from "@/components/org/ui";

export const metadata: Metadata = { title: "Project — Capabilio AI" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function OrgProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { ctx, service } = await orgPageContext("createProject");
  const project = await loadManagedProject(service, ctx, id);
  if (!project) notFound();
  const groups = await loadProjectGroups(service, project.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.title}
        subtitle={`Due ${formatDateTime(project.deadline_at)} · ${project.submission_type === "in_app" ? "in-app submission" : "physical submission"} · groups of ${project.team_size}${
          project.department_scope?.length ? ` · ${project.department_scope.join(", ")}` : " · all departments"
        }`}
        action={
          <div className="flex items-center gap-2">
            <Pill tone={project.status === "open" ? "ok" : "neutral"}>{project.status}</Pill>
            {project.status === "open" ? (
              <ActionButton action="/api/org/projects/status" body={{ projectId: project.id, status: "closed" }} label="Close" variant="ghost" confirm="Close this project? Students can no longer form groups or submit." />
            ) : (
              <ActionButton action="/api/org/projects/status" body={{ projectId: project.id, status: "open" }} label="Reopen" variant="ghost" />
            )}
          </div>
        }
      />
      <Panel title="Brief">
        <p className="whitespace-pre-wrap font-lp-body text-[13.5px] text-app-charcoal">{project.brief}</p>
      </Panel>

      {groups.length === 0 ? (
        <EmptyState title="No groups yet" body="Groups appear as students form them." />
      ) : (
        groups.map(({ group, members, reports, submission, grade }) => {
          const canGrade = group.status === "submitted" || group.status === "graded";
          return (
            <Panel key={group.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-lp-body text-[15px] font-semibold text-app-charcoal">{group.name}</h2>
                <Pill tone={group.status === "graded" ? "ok" : group.status === "forming" ? "warn" : "neutral"}>
                  {group.status} · {members.length}/{project.team_size}
                </Pill>
              </div>
              <ul className="mt-2 font-lp-body text-[13px] text-app-muted">
                {members.map((m) => (
                  <li key={m.id}>
                    {m.name}
                    {m.branch ? ` · ${m.branch}` : ""}
                    {m.role === "lead" ? " (lead)" : ""}
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                <h3 className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">Weekly reports</h3>
                {reports.length === 0 ? (
                  <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{project.weekly_report_required ? "None filed yet." : "Not required for this project."}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {reports.map((r) => (
                      <li key={r.id} className="rounded-lg border border-app-border p-3">
                        <p className="font-lp-mono text-[11px] text-app-muted">Week {r.week_number}</p>
                        <p className="mt-1 whitespace-pre-wrap font-lp-body text-[13px] text-app-charcoal">{r.content}</p>
                        {r.attachment_url && (
                          <a href={r.attachment_url} target="_blank" rel="noopener noreferrer" className="font-lp-body text-[12.5px] text-app-blue hover:underline">
                            Attachment
                          </a>
                        )}
                        {r.staff_feedback ? (
                          <p className="mt-2 rounded bg-white/[0.04] px-2 py-1 font-lp-body text-[12.5px] text-app-charcoal">Your feedback: {r.staff_feedback}</p>
                        ) : (
                          <div className="mt-2">
                            <JsonForm action="/api/org/report-feedback" extra={{ reportId: r.id }} submitLabel="Send feedback" fields={[{ name: "feedback", label: "Feedback", required: true }]} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <h3 className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">Submission</h3>
                {submission ? (
                  <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
                    {submission.submission_type === "physical" ? (
                      "Physical submission received."
                    ) : (
                      <a href={submission.link_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">
                        {submission.link_url}
                      </a>
                    )}{" "}
                    <span className="text-app-muted">({formatDateTime(submission.submitted_at)})</span>
                  </p>
                ) : (
                  <div className="mt-1 flex items-center gap-3">
                    <p className="font-lp-body text-[12.5px] text-app-muted">Nothing submitted.</p>
                    {project.submission_type === "physical" && group.status === "active" && (
                      <ActionButton action="/api/org/physical-received" body={{ groupId: group.id }} label="Mark physical submission received" variant="ghost" />
                    )}
                  </div>
                )}
              </div>

              {canGrade && (
                <div className="mt-4 border-t border-app-border pt-4">
                  <h3 className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">
                    {grade ? `Graded ${grade.grade}` : "Grade this group"}
                  </h3>
                  <p className="mb-2 font-lp-body text-[12px] text-app-muted">
                    One shared grade for the whole group — it becomes staff-verified evidence for each member. Contribution notes are optional and private to staff.
                  </p>
                  <JsonForm
                    action="/api/org/grades"
                    extra={{ groupId: group.id }}
                    submitLabel={grade ? "Update grade" : "Record grade"}
                    successMessage="Grade recorded and evidence created."
                    resetOnSuccess={false}
                    fields={[
                      { name: "grade", label: "Grade (e.g. A, 82)", required: true, defaultValue: grade?.grade },
                      { name: "feedback", label: "Feedback", type: "textarea", defaultValue: grade?.feedback ?? "" },
                      ...members.map((m) => ({
                        name: `notes.${m.user_id}`,
                        label: `Contribution note — ${m.name} (optional)`,
                        defaultValue: grade?.member_contribution_notes?.[m.user_id] ?? "",
                      })),
                    ]}
                  />
                </div>
              )}
            </Panel>
          );
        })
      )}
    </div>
  );
}
