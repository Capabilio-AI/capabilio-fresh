import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadCollege } from "@/lib/admin/colleges";
import { ROLE_LABEL } from "@/lib/admin/rules";
import { Bars, Chip, Empty, ExportLink, PageHeader, Section, Stat, Table, TD, humanise, when } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function CollegeDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("lists"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await loadCollege(id);
  if (!c) notFound();
  return (
    <div>
      <Link href="/admin/colleges" className="mb-3 inline-flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)]"><ArrowLeft size={14} aria-hidden /> All colleges</Link>
      <PageHeader eyebrow={[c.college.city, c.college.state].filter(Boolean).join(", ") || "College"} title={c.college.name} actions={can(admin, "export") ? <ExportLink kind="students" query={`college=${id}`} label="Export students" /> : undefined} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="ink" label="Students" value={c.totals.students} />
        <Stat label="Chose a role" value={c.totals.withRole} sub={c.totals.students ? `${Math.round((c.totals.withRole / c.totals.students) * 100)}% of students` : undefined} />
        <Stat label="Assessment done" value={c.totals.assessed} />
        <Stat label="Average ELO" value={c.totals.avgElo ?? "–"} sub="across students with a rating" />
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Section title="Branches" hint="Students per branch, and how many have chosen a role">
          <Bars rows={c.branches.map((b) => ({ label: b.branch, value: b.students, note: `${b.withRole} with a role` }))} empty="No students yet." />
        </Section>
        <Section title="Staff and leadership" hint="Accounts that run this college">
          {c.staff.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">No staff accounts.</p> : (
            <ul className="flex flex-col divide-y divide-[var(--m-rule)]">
              {c.staff.map((s) => (
                <li key={s.membershipId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 font-lp-body text-[13.5px]">
                  <span className="min-w-0"><Link href={`/admin/people/${s.userId}`} className="font-bold text-[var(--m-ink)] hover:underline">{s.name ?? show(s.email) ?? "Staff"}</Link><span className="block text-[12px] text-[var(--m-muted)]">{ROLE_LABEL[s.role] ?? humanise(s.role)} · {show(s.email)}</span></span>
                  <span className="flex items-center gap-2"><Chip>{s.status}</Chip>{s.status === "pending" && <Link href="/admin/approvals?kind=organisation" className="text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline">Decide</Link>}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      <h2 className="mb-3 font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Students</h2>
      {c.students.length === 0 ? <Empty title="No students yet" /> : (
        <Table head={["Student", "Roll number", "Branch", "Year", "Role chosen", "ELO", "Progress", "Joined"]}>
          {c.students.map((s) => (
            <tr key={s.userId} className="hover:bg-[var(--m-ground)]/50">
              <td className={TD}><Link href={`/admin/people/${s.userId}`} className="font-bold hover:underline">{s.name ?? "—"}</Link><span className="block text-[12px] text-[var(--m-muted)]">{show(s.email)}</span></td>
              <td className={`${TD} tabular-nums`}>{s.rollNumber ?? "—"}</td>
              <td className={TD}>{s.branch ?? "—"}</td>
              <td className={TD}>{s.year ?? "—"}</td>
              <td className={TD}>{s.role ?? <span className="text-[var(--m-muted)]">Not chosen</span>}</td>
              <td className={`${TD} tabular-nums font-semibold`}>{s.elo ?? "—"}</td>
              <td className={TD}>{s.onboarding ? <Chip tone={s.onboarding === "PROFILE_READY" ? "active" : "pending"}>{humanise(s.onboarding.toLowerCase())}</Chip> : "—"}</td>
              <td className={TD}>{when(s.joinedAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
