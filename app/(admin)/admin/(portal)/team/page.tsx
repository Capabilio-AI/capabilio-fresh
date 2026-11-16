import { requireAdminPage } from "@/lib/admin/db";
import { listAudit } from "@/lib/admin/audit";
import { listTeam } from "@/lib/admin/team";
import { ROLES, ROLE_LABEL, ROLE_SUMMARY } from "@/lib/admin/permissions";
import { peopleByIds } from "@/lib/admin/db";
import { TeamManager } from "@/components/admin/TeamManager";
import { Chip, PageHeader, Section, Table, TD, whenTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Owners only: who can open the console, what each may do, and what has been done to the team and the data. */
export default async function Team() {
  const admin = await requireAdminPage("team");
  const [{ members, rolesAvailable }, audit] = await Promise.all([listTeam(), listAudit(60)]);
  const people = await peopleByIds(audit.rows.map((r) => r.actorId).filter((x): x is string => !!x));
  return (
    <div>
      <PageHeader eyebrow="Access" title="Team" intro="Everyone who can open this console, and what each person may do. Access ends the moment you remove it: every page and action checks the list." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => <div key={r} className="rounded-2xl border border-[var(--m-rule)] bg-white p-4"><Chip tone="plain">{ROLE_LABEL[r]}</Chip><p className="mt-2 font-lp-body text-[12.5px] leading-relaxed text-[var(--m-muted)]">{ROLE_SUMMARY[r]}</p></div>)}
      </div>
      <TeamManager members={members} me={admin.userId} rolesAvailable={rolesAvailable} />
      <h2 className="mb-3 mt-8 font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Admin activity</h2>
      {!audit.available ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">The activity trail starts once migration 205 is applied.</p> : audit.rows.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">Nothing yet.</p> : (
        <Table head={["When", "Who", "What", "About", "Detail"]}>
          {audit.rows.map((r) => <tr key={r.id}><td className={`${TD} whitespace-nowrap`}>{whenTime(r.at)}</td><td className={TD}>{r.actorId ? people.get(r.actorId)?.name ?? "Admin" : "System"}</td><td className={`${TD} font-bold`}>{r.action}</td><td className={TD}>{r.target ?? "—"}</td><td className={TD}>{r.detail ?? "—"}</td></tr>)}
        </Table>
      )}
      <Section title="Good to know"><ul className="list-disc space-y-1 pl-5 font-lp-body text-[13px] text-[var(--m-muted)]"><li>You cannot change or remove yourself, and there is always at least one owner.</li><li>A new account gets a one-time password, shown once. They must choose their own before anything opens.</li><li>An analyst with contacts hidden sees names but not emails or phone numbers, and cannot export.</li></ul></Section>
    </div>
  );
}
