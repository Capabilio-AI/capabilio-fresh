import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import Link from "next/link";
import { loadCompanies } from "@/lib/admin/companies";
import { Chip, Empty, ExportLink, PageHeader, Stat, Table, TD, when } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Companies() {
  const admin = await requireAdminPage("lists"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const { rows, totals } = await loadCompanies();
  return (
    <div>
      <PageHeader eyebrow="Hiring" title="Companies" intro="Every company on Capabilio, the jobs it posted, who applied, and who it hired. Company account requests are decided in Approvals." actions={can(admin, "export") ? <ExportLink kind="companies" /> : undefined} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="ink" label="Companies" value={totals.companies} sub={`${totals.active} active · ${totals.pending} waiting`} href={totals.pending ? "/admin/approvals?kind=organisation" : undefined} />
        <Stat label="Jobs posted" value={totals.openings} sub={`${totals.openNow} open now`} />
        <Stat label="Applications" value={totals.applications} />
        <Stat label="Hired through Capabilio" value={totals.hired} sub={totals.applications ? `${Math.round((totals.hired / totals.applications) * 100)}% of applications` : undefined} />
      </div>
      {rows.length === 0 ? <Empty title="No companies yet">A company appears here once someone signs up for a company workspace.</Empty> : (
        <Table head={["Company", "Owner", "Status", "Jobs", "Open", "Applications", "Hired", "Joined"]}>
          {rows.map((c) => (
            <tr key={c.membershipId} className="hover:bg-[var(--m-ground)]/50">
              <td className={TD}><span className="font-bold">{c.name}</span><span className="block text-[12px] text-[var(--m-muted)]">{[c.industry, c.city].filter(Boolean).join(" · ") || "—"}</span></td>
              <td className={TD}>{c.owner ?? "—"}<span className="block text-[12px] text-[var(--m-muted)]">{show(c.ownerEmail)}</span></td>
              <td className={TD}><Chip>{c.status}</Chip>{c.status === "pending" && <Link href="/admin/approvals?kind=organisation" className="ml-2 text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline">Decide</Link>}</td>
              <td className={`${TD} tabular-nums`}>{c.openings}</td>
              <td className={`${TD} tabular-nums`}>{c.openNow}</td>
              <td className={`${TD} tabular-nums`}>{c.applications}</td>
              <td className={`${TD} tabular-nums font-semibold`}>{c.hired}</td>
              <td className={TD}>{when(c.joinedAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
