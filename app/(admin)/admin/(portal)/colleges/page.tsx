import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import Link from "next/link";
import { listColleges } from "@/lib/admin/colleges";
import { Chip, Empty, ExportLink, PageHeader, Stat, Table, TD, when } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Colleges({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdminPage("lists"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const { q = "" } = await searchParams;
  const rows = await listColleges(q);
  const students = rows.reduce((n, r) => n + r.students, 0);
  return (
    <div>
      <PageHeader eyebrow="Organisations" title="Colleges" intro="Every college with a student or staff member on Capabilio. Open one to see its students, branches, roll numbers, ratings and the roles they chose." actions={can(admin, "export") ? <ExportLink kind="colleges" /> : undefined} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat tone="ink" label="Colleges" value={rows.length} />
        <Stat label="Students enrolled" value={students} />
        <Stat label="Staff waiting for approval" value={rows.reduce((n, r) => n + r.staffPending, 0)} href="/admin/approvals?kind=organisation" />
      </div>
      <form className="mb-4" role="search"><input name="q" defaultValue={q} placeholder="Search colleges by name, city or state" aria-label="Search colleges" className="field-ring w-full max-w-md rounded-full border border-[var(--m-rule)] bg-white px-5 py-2.5 font-lp-body text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]" /></form>
      {rows.length === 0 ? <Empty title={q ? "No college matches" : "No colleges yet"}>{q ? "Try a shorter name." : "A college appears here once a student or staff member joins it."}</Empty> : (
        <Table head={["College", "Location", "Students", "Branches", "Staff", "Last joined"]}>
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-[var(--m-ground)]/50">
              <td className={TD}><Link href={`/admin/colleges/${c.id}`} className="font-bold hover:underline">{c.name}</Link></td>
              <td className={TD}>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
              <td className={`${TD} tabular-nums font-semibold`}>{c.students}</td>
              <td className={`${TD} tabular-nums`}>{c.branches}</td>
              <td className={TD}>{c.staffActive} active{c.staffPending > 0 && <> <Chip tone="pending">{c.staffPending} pending</Chip></>}</td>
              <td className={TD}>{when(c.lastJoined)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
