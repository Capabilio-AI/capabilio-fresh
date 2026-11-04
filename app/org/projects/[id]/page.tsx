import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { loadManagedProject } from "@/lib/org/project-access";
import { loadProjectGroups } from "@/lib/org/loaders";
import { loadProjectProgress, orderForStaff } from "@/lib/org/project-progress";
import { ActionButton } from "@/components/org/ActionButton";
import { AddToGroup } from "@/components/org/AddToGroup";
import { AttachmentList } from "@/components/org/AttachmentList";
import { signProjectFiles } from "@/lib/org/project-files-server";
import { loadProjectMentors } from "@/lib/org/mentorship";
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
  const allGroups = await loadProjectGroups(service, project.id);
  const groups = orderForStaff(allGroups);
  // independent reads together: this page reloads after every action, so each one saved is a faster save
  const [progress, mentors, urls] = await Promise.all([
    loadProjectProgress(service, project, allGroups),
    loadProjectMentors(service, project.id),
    signProjectFiles(service, allGroups.flatMap((g) => [...g.reports.flatMap((r) => r.attachments ?? []), ...(g.submission?.attachments ?? [])])),
  ]);
  const openGroups = allGroups.filter((g) => g.group.status === "forming" && g.members.length < project.team_size).map((g) => ({ id: g.group.id, label: `${g.group.name} (${g.members.length}/${project.team_size})` }));
  const { counts } = progress;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/org/projects" className="inline-flex w-fit items-center gap-1.5 font-lp-body text-[13px] font-semibold text-app-blue hover:underline">
        <ArrowLeft size={14} aria-hidden /> Projects
      </Link>
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
      <Panel title="Assignment and progress">
        <dl className="grid gap-x-8 gap-y-3 font-lp-body text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-[11.5px] uppercase tracking-wide text-app-muted">Assigned by</dt>
            <dd className="mt-0.5 font-semibold text-app-charcoal">{progress.assignedBy ? `${progress.assignedBy.name} (${progress.assignedBy.role.replace("_", " ")})` : "Staff"}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] uppercase tracking-wide text-app-muted">Assigned to</dt>
            <dd className="mt-0.5 font-semibold text-app-charcoal">
              {project.department_scope?.length ? project.department_scope.join(", ") : "All departments"} · {progress.eligible.toLocaleString("en-IN")} student{progress.eligible === 1 ? "" : "s"}
            </dd>
            <dd className="mt-0.5 text-[12px] text-app-muted">Students in these departments were notified when it was posted. They form groups of {project.team_size} themselves.</dd>
          </div>
        </dl>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["In a group", progress.inGroup, "text-app-charcoal"],
            ["Not in a group", progress.notInGroupTotal, progress.notInGroupTotal ? "text-app-warning" : "text-app-charcoal"],
            ["Waiting for grade", counts.submitted, counts.submitted ? "text-app-orange" : "text-app-charcoal"],
            ["Graded", counts.graded, "text-app-success"],
            ["Groups", counts.total, "text-app-charcoal"],
          ].map(([label, n, tone]) => (
            <li key={String(label)} className="rounded-xl border border-app-border px-3.5 py-3">
              <p className={`text-[22px] font-extrabold leading-none tabular-nums ${tone}`}>{Number(n).toLocaleString("en-IN")}</p>
              <p className="mt-1.5 text-[12px] text-app-muted">{label}</p>
            </li>
          ))}
        </ul>
        {progress.notInGroup.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-lp-body text-[13px] font-semibold text-app-orange hover:underline">Students not in a group yet ({progress.notInGroupTotal.toLocaleString("en-IN")})</summary>
            {project.status === "open" && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ActionButton action="/api/org/projects/remind" body={{ projectId: project.id }} label={`Remind ${progress.notInGroupTotal.toLocaleString("en-IN")} student${progress.notInGroupTotal === 1 ? "" : "s"}`} variant="ghost" />
                <span className="font-lp-body text-[12px] text-app-muted">Sends a notification. Once a day at most.</span>
              </div>
            )}
            <ul className="mt-3 flex flex-col divide-y divide-app-border font-lp-body text-[13px] text-app-charcoal">
              {progress.notInGroup.map((s) => (
                <li key={s.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    {s.name}
                    {s.branch && <span className="text-app-muted"> · {s.branch}</span>}
                  </span>
                  {project.status === "open" && <AddToGroup userId={s.userId} groups={openGroups} />}
                </li>
              ))}
            </ul>
            {progress.notInGroupTotal > progress.notInGroup.length && <p className="mt-2 font-lp-body text-[12px] text-app-muted">Showing the first {progress.notInGroup.length}.</p>}
          </details>
        )}
      </Panel>

      <Panel>
        <details>
          <summary className="cursor-pointer font-lp-body text-[13px] font-extrabold text-app-charcoal">Brief <span className="font-medium text-app-muted">· show or hide</span></summary>
          <p className="mt-3 whitespace-pre-wrap font-lp-body text-[13.5px] text-app-charcoal">{project.brief}</p>
        </details>
      </Panel>

      {groups.length === 0 ? (
        <EmptyState title="No groups yet" body="Groups appear as students form them." />
      ) : (
        groups.map(({ group, members, reports, submission, grade }) => {
          const canGrade = group.status === "submitted" || group.status === "graded";
          return (
            <Panel key={group.id} className="scroll-mt-24">
              <span id={`group-${group.id}`} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-lp-body text-[15px] font-semibold text-app-charcoal">{group.name}</h2>
                <span className="flex items-center gap-2">
                  {group.status === "submitted" && <Pill tone="warn">Needs grading</Pill>}
                  <Pill tone={group.status === "graded" ? "ok" : group.status === "forming" ? "warn" : "neutral"}>
                    {group.status} · {members.length}/{project.team_size}
                  </Pill>
                </span>
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

              {mentors.get(group.id) && <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">Mentor: <span className="font-semibold text-app-charcoal">{mentors.get(group.id)}</span></p>}

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
                        <AttachmentList files={r.attachments ?? []} urls={urls} />
                        {r.staff_feedback ? (
                          <p className="mt-2 rounded bg-white/[0.04] px-2 py-1 font-lp-body text-[12.5px] text-app-charcoal">Your feedback: {r.staff_feedback}</p>
                        ) : (
                          <div className="mt-2">
                            <JsonForm action="/api/org/report-feedback" extra={{ reportId: r.id }} submitLabel="Send feedback" fields={[{ name: "feedback", label: "Feedback for the group", type: "textarea", required: true, placeholder: "What went well, what to fix before next week." }]} />
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
                  <div>
                  <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
                    {submission.submission_type === "physical" ? (
                      "Physical submission received."
                    ) : submission.link_url ? (
                      <a href={submission.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-app-blue hover:underline">
                        <ExternalLink size={13} aria-hidden className="shrink-0" />
                        {submission.link_url}
                      </a>
                    ) : (
                      (submission.attachments?.length ?? 0) > 0 ? "Submitted with files." : "Submitted."
                    )}{" "}
                    <span className="text-app-muted">({formatDateTime(submission.submitted_at)})</span>
                  </p>
                  <AttachmentList files={submission.attachments ?? []} urls={urls} />
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-3">
                    <p className="font-lp-body text-[12.5px] text-app-muted">Nothing submitted.</p>
                    {project.submission_type === "physical" && group.status === "active" && (
                      <ActionButton action="/api/org/physical-received" body={{ groupId: group.id }} label="Mark physical submission received" variant="ghost" />
                    )}
                  </div>
                )}
              </div>

              {!canGrade && <p className="mt-4 border-t border-app-border pt-4 font-lp-body text-[12.5px] text-app-muted">Grading opens when this group submits its project. Until then you can read their weekly reports and leave feedback.</p>}

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
