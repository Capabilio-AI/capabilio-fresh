import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { IN_APP_APPROVABLE_ROLES } from "@/lib/org/roles";
import { ROLE_LABEL } from "@/lib/org/nav";
import { nameMap } from "@/lib/org/loaders";
import { untyped } from "@/lib/org/db";
import { ActionButton } from "@/components/org/ActionButton";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Members — Capabilio AI" };

const STAFF_ROLES = ["faculty", "hod", "tpo", "principal", "vice_principal"] as const;

export default async function MembersPage() {
  const { ctx, service } = await orgPageContext("approveMembers");
  // untyped: `tpo` is newer than the generated app_role type (see components/login/roles.ts)
  const { data } = await untyped(service)
    .from("institution_memberships")
    .select("id, user_id, role, status, created_at")
    .eq("institution_id", ctx.institutionId)
    .in("role", [...STAFF_ROLES])
    .neq("status", "revoked")
    .order("created_at");
  const rows = (data ?? []) as { id: string; user_id: string; role: string; status: string; created_at: string }[];
  const names = await nameMap(service, rows.map((r) => r.user_id));
  const pending = rows.filter((r) => r.status === "pending");
  const active = rows.filter((r) => r.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        subtitle="Approve faculty, heads of department and TPOs who applied to this institution. Principal and Vice Principal accounts are approved by the Capabilio team only."
      />
      <Panel title={`Awaiting approval (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyState title="No one is waiting" body="New staff appear here after they register with your institution's exact name and confirm their email." />
        ) : (
          <ul className="divide-y divide-app-border">
            {pending.map((m) => {
              const approvable = (IN_APP_APPROVABLE_ROLES as readonly string[]).includes(m.role);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{names.get(m.user_id) ?? "Applicant"}</p>
                    <p className="font-lp-mono text-[11px] text-app-muted">{ROLE_LABEL[m.role] ?? m.role}</p>
                  </div>
                  {approvable ? (
                    <div className="flex gap-2">
                      <ActionButton action="/api/org/members" body={{ membershipId: m.id, decision: "approve" }} label="Approve" />
                      <ActionButton action="/api/org/members" body={{ membershipId: m.id, decision: "reject" }} label="Reject" variant="danger" confirm="Reject this application?" />
                    </div>
                  ) : (
                    <Pill tone="warn">Capabilio team approval</Pill>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title={`Active staff (${active.length})`}>
        <ul className="divide-y divide-app-border">
          {active.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5">
              <span className="font-lp-body text-[13.5px] text-app-charcoal">{names.get(m.user_id) ?? "Member"}</span>
              <Pill>{ROLE_LABEL[m.role] ?? m.role}</Pill>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
