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
import { CopyLink } from "@/components/org/CopyLink";
import { inviteHref } from "@/lib/org/group-invite";
import { loadGroupMentorship } from "@/lib/org/mentorship";
import { askableMentors } from "@/lib/org/project-notices";
import { submitState } from "@/lib/org/submit-rules";
import { AttachmentList } from "@/components/org/AttachmentList";
import { ReportForm, SubmissionForm } from "@/components/org/ProjectWorkForms";
import type { ProjectFile } from "@/lib/org/project-files";
import { signProjectFiles } from "@/lib/org/project-files-server";

export const metadata: Metadata = { title: "Project — Capabilio AI" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ClassroomProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ group?: string }> }) {
  const { id } = await params;
  const invited = (await searchParams).group;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || ctx.kind !== "student") notFound();
  const service = createServiceClient();
  const project = (await loadStudentProjects(service, ctx)).find((p) => p.id === id);
  if (!project) notFound();
  const mine = project.myGroup;
  const urls = mine ? await signProjectFiles(service, [...mine.reports.flatMap((r) => r.attachments ?? []), ...(mine.submission?.attachments ?? [])]) : new Map<string, string>();
  const isLead = Boolean(mine?.members.some((m) => m.user_id === ctx.userId && m.role === "lead"));
  const submit = mine ? submitState(mine.group, isLead) : null;
  const mentorship = mine ? await loadGroupMentorship(service, mine.group.id, ctx.institutionId, mine.members.map((m) => m.user_id)) : null;
  const open = project.acceptingWork;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <Link href="/arena/projects" className="font-lp-body text-[13px] text-app-blue hover:underline">
          ← Projects
        </Link>
        <h1 className="mt-2 font-lp-display text-[26px] font-bold text-[var(--m-ink)]">{project.title}</h1>
        <p className="font-lp-mono text-[11.5px] text-app-muted">
          Due {formatDateTime(project.deadline_at)} · groups of {project.team_size} · {project.submission_type === "in_app" ? "submit a link here" : "physical submission, marked received by staff"}
        </p>
      </div>
      <section className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
        <p className="whitespace-pre-wrap font-lp-body text-[13.5px] text-[var(--m-ink)]">{project.brief}</p>
      </section>

      {!mine ? (
        <>
          {open && project.openGroups.some((g) => g.group.id === invited) && (() => {
            const g = project.openGroups.find((x) => x.group.id === invited)!;
            const req = project.myRequests[g.group.id];
            return (
              <section className="rounded-xl border-2 border-[var(--m-ink)] bg-white p-5">
                <p className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">You were invited</p>
                <h2 className="mt-1 font-lp-body text-[16px] font-semibold text-[var(--m-ink)]">{g.group.name}</h2>
                <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{g.memberCount}/{project.team_size} members. The group lead will accept or reject your request.</p>
                <div className="mt-3">
                  {req?.status === "pending" ? <Pill tone="warn">Request sent. Waiting for the lead.</Pill> : req?.status === "rejected" ? <Pill tone="neutral">The lead declined this request</Pill> : <ActionButton action="/api/classroom/groups/join" body={{ groupId: g.group.id }} label="Request to join" />}
                </div>
              </section>
            );
          })()}
          {open ? (
            <section className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
              <h2 className="mb-1 font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Start a group</h2>
              <p className="mb-3 font-lp-body text-[12.5px] text-app-muted">You become the lead. Classmates from any department can join until it has {project.team_size} members.</p>
              <JsonForm action="/api/classroom/groups" extra={{ projectId: project.id }} submitLabel="Create group" successMessage="Group created." fields={[{ name: "name", label: "Group name", required: true }]} />
            </section>
          ) : (
            <EmptyState title="This project is closed" body="Groups can no longer be formed." />
          )}
          <section className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
            <h2 className="mb-3 font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Groups still forming</h2>
            {project.openGroups.length === 0 ? (
              <p className="font-lp-body text-[12.5px] text-app-muted">No groups are looking for members right now.</p>
            ) : (
              <ul className="divide-y divide-app-border">
                {project.openGroups.map((g) => (
                  <li key={g.group.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-lp-body text-[13.5px] font-medium text-[var(--m-ink)]">{g.group.name}</p>
                      <p className="font-lp-mono text-[11px] text-app-muted">
                        {g.memberCount}/{project.team_size} members · {project.team_size - g.memberCount} slot{project.team_size - g.memberCount === 1 ? "" : "s"} open
                        {g.memberBranches.length ? ` · ${g.memberBranches.join(", ")}` : ""}
                      </p>
                    </div>
                    {open && (() => {
                      const req = project.myRequests[g.group.id];
                      if (req?.status === "rejected") return <Pill tone="neutral">Declined</Pill>;
                      if (req?.status === "pending")
                        return (
                          <span className="flex items-center gap-2">
                            <Pill tone="warn">Request sent</Pill>
                            <ActionButton action="/api/classroom/groups/requests/cancel" body={{ requestId: req.id }} label="Cancel" variant="ghost" />
                          </span>
                        );
                      return <ActionButton action="/api/classroom/groups/join" body={{ groupId: g.group.id }} label="Request to join" />;
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-lp-body text-[15px] font-semibold text-[var(--m-ink)]">{mine.group.name}</h2>
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
            {mine.group.status === "forming" && <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">{mine.members.length} of {project.team_size} members. You can wait for {project.team_size - mine.members.length} more, or {isLead ? "submit with the people who are in the group" : "ask your group lead to submit with the current members"}.</p>}
            {(mine.group.status === "forming" || mine.group.status === "active") && (
              <div className="mt-3">
                <ActionButton action="/api/classroom/groups/leave" body={{ groupId: mine.group.id }} label="Leave group" variant="danger" confirm="Leave this group?" />
              </div>
            )}
          </section>

          {mine.group.status === "forming" && mine.members.some((m) => m.user_id === ctx.userId && m.role === "lead") && (
            <section className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
              <h2 className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Invite classmates</h2>
              <p className="mb-3 mt-1 font-lp-body text-[12.5px] text-app-muted">Share this link. Classmates who open it can ask to join, and you accept or reject each request.</p>
              <CopyLink path={inviteHref(project.id, mine.group.id)} />
              <h3 className="mt-5 font-lp-body text-[13px] font-semibold text-[var(--m-ink)]">Join requests{project.joinRequests.length ? ` (${project.joinRequests.length})` : ""}</h3>
              {project.joinRequests.length === 0 ? (
                <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">No requests yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-app-border">
                  {project.joinRequests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="font-lp-body text-[13.5px] font-medium text-[var(--m-ink)]">{r.name}</p>
                        <p className="font-lp-mono text-[11px] text-app-muted">Asked {formatDateTime(r.createdAt)}</p>
                      </div>
                      <span className="flex items-center gap-2">
                        <ActionButton action="/api/classroom/groups/requests/decide" body={{ requestId: r.id, decision: "accept" }} label="Accept" />
                        <ActionButton action="/api/classroom/groups/requests/decide" body={{ requestId: r.id, decision: "reject" }} label="Reject" variant="ghost" confirm={`Reject ${r.name}'s request? They will not be able to ask this group again.`} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {mentorship && mine.group.status !== "graded" && (
            <section className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
              <h2 className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Mentor</h2>
              {mentorship.mentor ? (
                <p className="mt-1 font-lp-body text-[13px] text-[var(--m-ink)]">{mentorship.mentor.name} <span className="text-app-muted">({mentorship.mentor.role === "hod" ? "HoD" : "faculty"}) is mentoring your group.</span></p>
              ) : (
                <>
                  <p className="mb-3 mt-1 font-lp-body text-[12.5px] text-app-muted">Ask a faculty member to mentor your group. They can accept, or decline and tell you why.</p>
                  {mentorship.requests.filter((r) => r.status !== "cancelled").length > 0 && (
                    <ul className="mb-4 divide-y divide-app-border">
                      {mentorship.requests.filter((r) => r.status !== "cancelled").map((r) => (
                        <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <p className="font-lp-body text-[13.5px] font-medium text-[var(--m-ink)]">{r.mentorName}</p>
                            {r.status === "rejected" && <p className="mt-0.5 max-w-xl font-lp-body text-[12.5px] text-app-muted">Declined{r.reason ? `: ${r.reason}` : "."}</p>}
                          </div>
                          {r.status === "pending" ? (
                            <span className="flex items-center gap-2">
                              <Pill tone="warn">Waiting for an answer</Pill>
                              <ActionButton action="/api/classroom/mentors/cancel" body={{ requestId: r.id }} label="Cancel" variant="ghost" />
                            </span>
                          ) : (
                            <Pill tone="neutral">Declined</Pill>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(() => {
                    const options = askableMentors(mentorship.options, mentorship.requests.map((r) => ({ mentorMembershipId: r.mentorMembershipId, status: r.status })));
                    return options.length === 0 ? (
                      <p className="font-lp-body text-[12.5px] text-app-muted">No other faculty to ask right now.</p>
                    ) : (
                      <JsonForm
                        action="/api/classroom/mentors/request"
                        extra={{ groupId: mine.group.id }}
                        submitLabel="Send request"
                        successMessage="Request sent."
                        fields={[
                          { name: "mentorMembershipId", label: "Faculty member", type: "select", required: true, options: [{ value: "", label: "Choose…" }, ...options.map((o) => ({ value: o.membershipId, label: `${o.name} (${o.role === "hod" ? "HoD" : "faculty"}${o.branch ? `, ${o.branch}` : ""})` }))] },
                          { name: "message", label: "Message (optional)", type: "textarea", placeholder: "What you are building and why you would like their guidance." },
                        ]}
                      />
                    );
                  })()}
                </>
              )}
            </section>
          )}

          {mine.group.status === "graded" && mine.grade && (
            <section className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
              <h2 className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Grade: {mine.grade.grade}</h2>
              {mine.grade.feedback && <p className="mt-1 whitespace-pre-wrap font-lp-body text-[13px] text-[var(--m-ink)]">{mine.grade.feedback}</p>}
              {mine.grade.member_contribution_notes?.[ctx.userId] && (
                <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">Note for you: {mine.grade.member_contribution_notes[ctx.userId]}</p>
              )}
              <p className="mt-2 font-lp-body text-[12px] text-app-muted">This is a shared, staff-verified group grade. It now appears as evidence on each member&apos;s Portfolio.</p>
            </section>
          )}

          {project.submission_type === "in_app" && submit !== "graded" && (
            <section className="rounded-2xl border border-[var(--m-rule)] bg-white p-6 sm:p-7">
              <h2 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Final submission</h2>
              <p className="mb-5 mt-1 font-lp-body text-[13px] text-app-muted">Submit your project as a link, files or both. Your faculty is notified and grades the whole group together.</p>
              {submit === "small-lead" && <p className="mb-5 rounded-xl border border-[var(--m-rule)] bg-app-background px-4 py-3 font-lp-body text-[12.5px] text-[var(--m-ink)]">Your group has {mine.members.length} of {project.team_size} members. If you submit now, the group closes and nobody else can join.</p>}
              {submit === "small-wait" && <p className="mb-5 rounded-xl border border-[var(--m-rule)] bg-app-background px-4 py-3 font-lp-body text-[12.5px] text-[var(--m-ink)]">Your group has {mine.members.length} of {project.team_size} members. Only your group lead can submit it before it is full.</p>}
              {mine.submission && (
                <div className="mb-6 rounded-xl border border-[var(--m-rule)] bg-app-background p-4">
                  <p className="font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">Submitted {formatDateTime(mine.submission.submitted_at)}</p>
                  {mine.submission.link_url && (
                    <a href={mine.submission.link_url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-lp-body text-[13px] text-app-blue hover:underline">{mine.submission.link_url}</a>
                  )}
                  {mine.submission.report && <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-lp-body text-[13px] leading-relaxed text-[var(--m-ink)]">{mine.submission.report}</p>}
                  <AttachmentList files={mine.submission.attachments ?? []} urls={urls} />
                  <p className="mt-3 font-lp-body text-[12px] text-app-muted">You can resubmit until it is graded.</p>
                </div>
              )}
              {open && submit !== "small-wait" && <SubmissionForm closesGroup={submit === "small-lead"} key={mine.submission?.submitted_at ?? "new"} groupId={mine.group.id} resubmit={Boolean(mine.submission)} initialLink={mine.submission?.link_url ?? undefined} initialFiles={mine.submission?.attachments ?? []} initialReport={mine.submission?.report ?? undefined} />}
            </section>
          )}
          {mine.submission && mine.group.status === "graded" && (
            <section className="rounded-2xl border border-[var(--m-rule)] bg-white p-6">
              <h2 className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">What you submitted</h2>
              {mine.submission.link_url && <a href={mine.submission.link_url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-lp-body text-[13px] text-app-blue hover:underline">{mine.submission.link_url}</a>}
              {mine.submission.report && <p className="mt-2 whitespace-pre-wrap font-lp-body text-[13px] leading-relaxed text-[var(--m-ink)]">{mine.submission.report}</p>}
              <AttachmentList files={mine.submission.attachments ?? []} urls={urls} />
            </section>
          )}
          {project.submission_type === "physical" && (
            <section className="rounded-2xl border border-[var(--m-rule)] bg-white p-6">
              <h2 className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">Submission</h2>
              <p className="mt-1 font-lp-body text-[13px] text-app-muted">{mine.submission ? "Your physical submission was received by staff." : "Hand in your work as instructed; staff will mark it received here."}</p>
            </section>
          )}

          {project.weekly_report_required && (
            <section className="rounded-2xl border border-[var(--m-rule)] bg-white p-6 sm:p-7">
              <h2 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Weekly reports</h2>
              <p className="mb-5 mt-1 font-lp-body text-[13px] text-app-muted">Progress notes for your faculty. They are process updates, not evidence: only the final grade counts toward your Portfolio.</p>
              {mine.reports.length > 0 && (
                <ul className="mb-7 flex flex-col gap-3">
                  {mine.reports.map((r) => (
                    <li key={r.id} className="rounded-xl border border-[var(--m-rule)] p-4">
                      <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Week {r.week_number}</p>
                      <p className="mt-1.5 whitespace-pre-wrap font-lp-body text-[14px] leading-relaxed text-[var(--m-ink)]">{r.content}</p>
                      {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all font-lp-body text-[13px] text-app-blue hover:underline">{r.attachment_url}</a>}
                      <AttachmentList files={r.attachments ?? []} urls={urls} />
                      {r.staff_feedback && <p className="mt-3 rounded-lg bg-app-background px-3 py-2 font-lp-body text-[13px] text-[var(--m-ink)]"><span className="font-semibold">Faculty feedback: </span>{r.staff_feedback}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {open && mine.group.status !== "graded" && (
                <>
                  <h3 className="mb-4 font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Add this week&apos;s report</h3>
                  <ReportForm groupId={mine.group.id} nextWeek={Math.min(52, Math.max(0, ...mine.reports.map((r) => r.week_number)) + 1)} existing={mine.reports.map((r) => ({ week: r.week_number, content: r.content, link: r.attachment_url, files: (r.attachments ?? []) as ProjectFile[] }))} />
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
