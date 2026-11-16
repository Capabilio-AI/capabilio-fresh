import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import Link from "next/link";
import { loadProfessionals } from "@/lib/admin/professionals";
import { Chip, Empty, ExportLink, PageHeader, Stat, Table, TD, when } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Professionals() {
  const admin = await requireAdminPage("lists"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const { rows, stats } = await loadProfessionals();
  return (
    <div>
      <PageHeader eyebrow="Working professionals" title="Professionals" intro="Who has joined, who is EPFO verified, and who wants to mentor. Mentor applications are decided in Approvals." actions={can(admin, "export") ? <ExportLink kind="professionals" /> : undefined} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="ink" label="Professionals" value={stats.total} />
        <Stat label="EPFO verified" value={stats.epfoVerified} sub={`${stats.epfoPending} pending · ${stats.epfoOther} failed or closed`} />
        <Stat label="Interested in mentoring" value={stats.interested} sub={`${stats.eligible} have 10+ years`} />
        <Stat label="Mentors" value={stats.mentorsApproved} sub={`${stats.mentorsPending} waiting`} href="/admin/approvals?kind=mentor" />
      </div>
      {rows.length === 0 ? <Empty title="No professionals yet">They appear here after signing up on the professional path.</Empty> : (
        <Table head={["Professional", "Works at", "Experience", "EPFO", "Mentoring", "Joined"]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-[var(--m-ground)]/50">
              <td className={TD}><Link href={`/admin/people/${p.id}`} className="font-bold hover:underline">{p.name ?? "—"}</Link><span className="block text-[12px] text-[var(--m-muted)]">{show(p.email)}</span></td>
              <td className={TD}>{[p.title, p.employer].filter(Boolean).join(" at ") || "—"}</td>
              <td className={`${TD} tabular-nums`}>{p.experience}{p.eligible && <span className="ml-1.5 text-[11.5px] font-bold text-[#0b5d3f]">10y+</span>}</td>
              <td className={TD}><Chip tone={p.epfo === "none" ? "plain" : p.epfo}>{p.epfo === "none" ? "not started" : p.epfo}</Chip></td>
              <td className={TD}>{p.mentor === "none" ? <span className="text-[var(--m-muted)]">—</span> : <Chip tone={p.mentor}>{p.mentor}</Chip>}</td>
              <td className={TD}>{when(p.joinedAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
