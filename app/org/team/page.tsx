import type { Metadata } from "next";
import { headers } from "next/headers";
import { orgPageContext } from "@/lib/org/page";
import { loadJoinLinks, loadTeam } from "@/lib/org/team-data";
import { grantablePermissions, joinUrl } from "@/lib/org/team";
import { ORG_PERMISSIONS } from "@/lib/org/roles";
import { ROLE_LABEL } from "@/lib/org/nav";
import { ActionButton } from "@/components/org/ActionButton";
import { JsonForm } from "@/components/org/JsonForm";
import { InvitationActions, InviteStaffForm, JoinLinkActions, MemberActions } from "@/components/org/TeamClient";
import { Collapsible, EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Team & access — Capabilio AI" };

const LABEL = new Map<string, string>(ORG_PERMISSIONS.map((p) => [p.key, p.label]));

export default async function TeamPage() {
  const { ctx, service } = await orgPageContext("approveMembers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const [team, links] = await Promise.all([loadTeam(service, ctx), loadJoinLinks(service, ctx)]);
  const grantable = [...grantablePermissions(ctx)];
  const isAdmin = ctx.kind === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team & access"
        subtitle="Bring your students in with a link, invite staff by email, and decide exactly what each person can do. Nobody gets a separate login system — everyone uses the same sign-in."
      />

      <Panel title="Student join link">
        <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-app-muted">
          Share this link with students. It opens {ctx.institutionName}&apos;s sign-up on Capabilio with the college already filled in, so they land in the right place — no searching for the college name.
        </p>
        <ul className="flex flex-col gap-3">
          {links.map((l) => {
            const url = joinUrl(origin, l.code);
            return (
              <li key={l.id} className={`rounded-2xl border border-app-border p-4 ${l.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13.5px] font-bold text-app-charcoal">
                    {l.label ?? "Student link"}
                    {l.branch ? ` · ${l.branch}` : ""}
                    {l.endYear ? ` · class of ${l.endYear}` : ""}
                  </p>
                  <Pill tone={l.active ? "ok" : "neutral"}>{l.active ? `${l.joined} joined` : "Off"}</Pill>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-white/[0.05] px-3 py-2 font-lp-mono text-[12px] text-app-charcoal">{url}</code>
                </div>
                <div className="mt-3">
                  <JoinLinkActions id={l.id} url={url} active={l.active} collegeName={ctx.institutionName} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <Collapsible title="Create another link (for a branch or batch)">
            <JsonForm
              action="/api/org/join-links"
              submitLabel="Create link"
              successMessage="Link created — it's in the list above."
              fields={[
                { name: "label", label: "Name", placeholder: "CSE 2027 batch" },
                { name: "branch", label: "Pre-fill branch", placeholder: "Computer Science" },
                { name: "endYear", label: "Pre-fill graduation year", type: "number", placeholder: "2027" },
              ]}
            />
          </Collapsible>
        </div>
      </Panel>

      <Collapsible title="Invite a staff member" defaultOpen={team.invitations.length === 0 && team.active.length <= 1}>
        <p className="mb-4 max-w-2xl text-[12.5px] leading-relaxed text-app-muted">
          They receive a link, choose their name and password, and land in the workspace with only the access you grant here. Invitations work once and expire in 7 days.
        </p>
        <InviteStaffForm grantable={grantable} institutionName={ctx.institutionName} canGrantAdmin={isAdmin} />
      </Collapsible>

      {team.invitations.length > 0 && (
        <Panel title={`Invitations waiting (${team.invitations.length})`}>
          <ul className="divide-y divide-app-border">
            {team.invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[13.5px] font-semibold text-app-charcoal">{i.email}</p>
                  <p className="text-[11.5px] text-app-muted">
                    {ROLE_LABEL[i.role] ?? i.role} · {i.expired ? "expired" : `expires ${new Date(i.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}`}
                  </p>
                </div>
                <InvitationActions id={i.id} email={i.email} role={i.role} institutionName={ctx.institutionName} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {team.pending.length > 0 && (
        <Panel title={`Registrations awaiting approval (${team.pending.length})`}>
          <p className="mb-3 text-[12.5px] text-app-muted">These people registered with your college&apos;s exact name. Approve them only if you know them.</p>
          <ul className="divide-y divide-app-border">
            {team.pending.map((m) => (
              <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[13.5px] font-semibold text-app-charcoal">{m.name}</p>
                  <p className="text-[11.5px] text-app-muted">
                    {m.email} · {ROLE_LABEL[m.role] ?? m.role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ActionButton action="/api/org/members" body={{ membershipId: m.membershipId, decision: "approve" }} label="Approve" />
                  <ActionButton action="/api/org/members" body={{ membershipId: m.membershipId, decision: "reject" }} label="Reject" variant="danger" confirm="Reject this registration?" />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={`Team (${team.active.length})`}>
        {team.active.length === 0 ? (
          <EmptyState title="No one yet" body="Invite your first staff member above." />
        ) : (
          <ul className="divide-y divide-app-border">
            {team.active.map((m) => (
              <li key={m.membershipId} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-app-charcoal">
                      {m.name}
                      {m.isSelf && <span className="ml-2 text-[11px] font-semibold text-app-muted">(you)</span>}
                    </p>
                    <p className="text-[11.5px] text-app-muted">
                      {m.email} · {ROLE_LABEL[m.role] ?? m.role}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {m.isAdmin ? <Pill tone="ok">Full access</Pill> : m.permissions.length === 0 ? <Pill>No access</Pill> : m.permissions.map((p) => <Pill key={p}>{LABEL.get(p) ?? p}</Pill>)}
                      {m.custom && <Pill tone="info">Custom</Pill>}
                    </p>
                  </div>
                  {!m.isSelf && (
                    <MemberActions
                      membershipId={m.membershipId}
                      name={m.name}
                      role={m.role}
                      permissions={m.permissions}
                      canEdit={!m.isAdmin}
                      canRemove={m.role !== "principal" && (!m.isAdmin || isAdmin)}
                      grantable={grantable}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="text-[12px] text-app-muted">Need to hand the principal role to someone else? The Capabilio team does that, so it stays safe.</p>
    </div>
  );
}
