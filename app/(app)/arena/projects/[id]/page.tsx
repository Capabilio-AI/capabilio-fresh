import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { loadStudentProjects } from "@/lib/org/loaders";
import { ActionButton } from "@/components/org/ActionButton";
import { JsonForm } from "@/components/org/JsonForm";
import { EmptyState, Pill, formatDateTime } from "@/components/org/ui";

export const metadata: Metadata = { title: "Project — Capabilio AI" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ClassroomProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || ctx.kind !== "student") notFound();
  const service = createServiceClient();
  const project = (await loadStudentProjects(service, ctx)).find((p) => p.id === id);
  if (!project) notFound();
  const mine = project.myGroup;
  const open = project.acceptingWork;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <Link href="/arena/projects" className="font-lp-body text-[13px] text-app-blue hover:underline">
          ← Projects
        </Link>
        <h1 className="mt-2 font-lp-display text-[26px] font-semibold text-app-charcoal">{project.title}</h1>
        <p className="font-lp-mono text-[11.5px] text-app-muted">
          Due {formatDateTime(project.deadline_at)} · groups of {project.team_size} · {project.submission_type === "in_app" ? "submit a link here" : "physical submission, marked received by staff"}
        </p>
      </div>
      <section className="rounded-xl border border-app-border bg-white p-5">
        <p className="whitespace-pre-wrap font-lp-body text-[13.5px] text-app-charcoal">{project.brief}</p>
      </section>

      {!mine ? (
        <>
          {open ? (
            <section className="rounded-xl border border-app-border bg-white p-5">
              <h2 className="mb-1 font-lp-body text-[14px] font-semibold text-app-charcoal">Start a group</h2>
              <p className="mb-3 font-lp-body text-[12.5px] text-app-muted">You become the lead. Classmates from any department can join until it has {project.team_size} members.</p>
              <JsonForm action="/api/classroom/groups" extra={{ projectId: project.id }} submitLabel="Create group" successMessage="Group created." fields={[{ name: "name", label: "Group name", required: true }]} />
            </section>
          ) : (
            <EmptyState title="This project is closed" body="Groups can no longer be formed." />
          )}
          <section className="rounded-xl border border-app-border bg-white p-5">
            <h2 className="mb-3 font-lp-body text-[14px] font-semibold text-app-charcoal">Groups still forming</h2>
            {project.openGroups.length === 0 ? (
              <p className="font-lp-body text-[12.5px] text-app-muted">No groups are looking for members right now.</p>
            ) : (
              <ul className="divide-y divide-app-border">
                {project.openGroups.map((g) => (
                  <li key={g.group.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{g.group.name}</p>
                      <p className="font-lp-mono text-[11px] text-app-muted">
                        {g.memberCount}/{project.team_size} members · {project.team_size - g.memberCount} slot{project.team_size - g.memberCount === 1 ? "" : "s"} open
                        {g.memberBranches.length ? ` · ${g.memberBranches.join(", ")}` : ""}
                      </p>
                    </div>
                    {open && <ActionButton action="/api/classroom/groups/join" body={{ groupId: g.group.id }} label="Join" />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-xl border border-app-border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-lp-body text-[15px] font-semibold text-app-charcoal">{mine.group.name}</h2>
              <Pill tone={mine.group.status === "graded" ? "ok" : mine.group.status === "forming" ? "warn" : "neutral"}>
                {mine.group.status} · {mine.members.length}/{project.team_size}
              </Pill>
            </div>
            <ul className="mt-2 font-lp-body text-[13px] text-app-muted">
              {mine.members.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.branch ? ` · ${m.branch}` : ""}
                  {m.role === "lead" ? " (lead)" : ""}
                </li>
              ))}
            </ul>
            {mine.group.status === "forming" && <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">Waiting for {project.team_size - mine.members.length} more member(s) before you can submit.</p>}
            {(mine.group.status === "forming" || mine.group.status === "active") && (
              <div className="mt-3">
                <ActionButton action="/api/classroom/groups/leave" body={{ groupId: mine.group.id }} label="Leave group" variant="danger" confirm="Leave this group?" />
              </div>
            )}
          </section>

          {mine.group.status === "graded" && mine.grade && (
            <section className="rounded-xl border border-app-border bg-white p-5">
              <h2 className="font-lp-body text-[14px] font-semibold text-app-charcoal">Grade: {mine.grade.grade}</h2>
              {mine.grade.feedback && <p className="mt-1 whitespace-pre-wrap font-lp-body text-[13px] text-app-charcoal">{mine.grade.feedback}</p>}
              {mine.grade.member_contribution_notes?.[ctx.userId] && (
                <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">Note for you: {mine.grade.member_contribution_notes[ctx.userId]}</p>
              )}
              <p className="mt-2 font-lp-body text-[12px] text-app-muted">This is a shared, staff-verified group grade. It now appears as evidence on each member&apos;s Portfolio.</p>
            </section>
          )}

          {mine.group.status !== "forming" && project.submission_type === "in_app" && mine.group.status !== "graded" && (
            <section className="rounded-xl border border-app-border bg-white p-5">
              <h2 className="mb-1 font-lp-body text-[14px] font-semibold text-app-charcoal">Submission</h2>
              {mine.submission && (
                <p className="mb-2 font-lp-body text-[12.5px] text-app-muted">
                  Submitted {formatDateTime(mine.submission.submitted_at)}:{" "}
                  <a href={mine.submission.link_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">
                    {mine.submission.link_url}
                  </a>
                  . You can resubmit until it is graded.
                </p>
              )}
              {open && <JsonForm action="/api/classroom/submissions" extra={{ groupId: mine.group.id }} submitLabel={mine.submission ? "Resubmit" : "Submit"} successMessage="Submitted." fields={[{ name: "linkUrl", label: "Link to your work", type: "url", required: true, placeholder: "https://…" }]} />}
            </section>
          )}
          {project.submission_type === "physical" && (
            <section className="rounded-xl border border-app-border bg-white p-5">
              <h2 className="font-lp-body text-[14px] font-semibold text-app-charcoal">Submission</h2>
              <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{mine.submission ? "Your physical submission was received by staff." : "Hand in your work as instructed; staff will mark it received here."}</p>
            </section>
          )}

          {project.weekly_report_required && (
            <section className="rounded-xl border border-app-border bg-white p-5">
              <h2 className="mb-1 font-lp-body text-[14px] font-semibold text-app-charcoal">Weekly reports</h2>
              <p className="mb-3 font-lp-body text-[12px] text-app-muted">Progress notes for your faculty. They&apos;re process updates, not evidence — only the final grade counts toward your Portfolio.</p>
              {mine.reports.length > 0 && (
                <ul className="mb-4 flex flex-col gap-2">
                  {mine.reports.map((r) => (
                    <li key={r.id} className="rounded-lg border border-app-border p-3">
                      <p className="font-lp-mono text-[11px] text-app-muted">Week {r.week_number}</p>
                      <p className="mt-1 whitespace-pre-wrap font-lp-body text-[13px] text-app-charcoal">{r.content}</p>
                      {r.staff_feedback && <p className="mt-2 rounded bg-app-background px-2 py-1 font-lp-body text-[12.5px] text-app-charcoal">Faculty: {r.staff_feedback}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {open && mine.group.status !== "graded" && (
                <JsonForm
                  action="/api/classroom/reports"
                  extra={{ groupId: mine.group.id }}
                  submitLabel="Save report"
                  successMessage="Report saved."
                  fields={[
                    { name: "weekNumber", label: "Week number", type: "number", required: true, defaultValue: String(mine.reports.length + 1) },
                    { name: "content", label: "What did the group do this week?", type: "textarea", required: true },
                    { name: "attachmentUrl", label: "Attachment link (optional)", type: "url" },
                  ]}
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
