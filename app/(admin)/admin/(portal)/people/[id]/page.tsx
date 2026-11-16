import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadPerson } from "@/lib/admin/people";
import { ROLE_LABEL } from "@/lib/admin/rules";
import { Chip, PageHeader, Section, Stat, humanise, when, whenTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
const PATH: Record<string, string> = { student: "Student", graduate: "Graduate", professional: "Professional", other: "No path yet" };

export default async function PersonDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage(["lists", "lookup"]); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await loadPerson(id);
  if (!p) notFound();
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-2 font-lp-body text-[13.5px]"><dt className="text-[var(--m-muted)]">{k}</dt><dd className="text-right font-semibold text-[var(--m-ink)]">{v ?? "—"}</dd></div>;
  return (
    <div>
      <Link href="/admin/people" className="mb-3 inline-flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)]"><ArrowLeft size={14} aria-hidden /> People</Link>
      <PageHeader eyebrow={PATH[p.kind]} title={p.name ?? "No name"} intro={[p.email ? show(p.email) : null, p.headline].filter(Boolean).join(" · ")} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat tone="ink" label="Joined" value={when(p.joinedAt)} />
        <Stat label="Role chosen" value={<span className="text-[26px]">{p.role?.primary ?? (p.role?.exploring ? "Exploring" : "None")}</span>} sub={p.role?.planB ? `Plan B: ${p.role.planB}` : undefined} />
        <Stat label="Highest ELO" value={p.elo.length ? Math.max(...p.elo.map((e) => e.rating)) : "–"} sub={p.elo.length ? `${p.elo.length} role${p.elo.length === 1 ? "" : "s"} rated` : "no ratings yet"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Account"><dl className="divide-y divide-[var(--m-rule)]">{row("Email", show(p.email))}{row("Phone", can(admin, "contacts") ? p.phone : p.phone ? "hidden" : null)}{row("Location", p.location)}{row("Plan", p.plan)}{row("Assessment", p.onboarding ? humanise(p.onboarding.toLowerCase()) : null)}</dl></Section>
        <Section title="Where they belong" hint="Colleges and organisations">
          {p.memberships.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">No organisation.</p> : (
            <ul className="divide-y divide-[var(--m-rule)]">{p.memberships.map((m) => <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 font-lp-body text-[13.5px]"><span className="min-w-0"><span className="font-bold text-[var(--m-ink)]">{m.institution}</span><span className="block text-[12px] text-[var(--m-muted)]">{ROLE_LABEL[m.role] ?? m.role}{m.branch ? ` · ${m.branch}` : ""}{m.roll ? ` · roll ${m.roll}` : ""}{m.year ? ` · ${m.year}` : ""}</span></span><Chip>{m.status}</Chip></li>)}</ul>
          )}
        </Section>
        {p.pro && (
          <Section title="Professional" hint="Work and verification">
            <dl className="divide-y divide-[var(--m-rule)]">{row("Employer", p.pro.employer)}{row("Title", p.pro.title)}{row("EPFO", p.pro.epfo ? <Chip>{p.pro.epfo}</Chip> : "Not started")}{row("Mentoring", p.pro.mentor ? <Chip>{p.pro.mentor}</Chip> : "Not applied")}</dl>
          </Section>
        )}
        <Section title="Ratings" hint="ELO per role">
          {p.elo.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">No role assessment yet.</p> : <dl className="divide-y divide-[var(--m-rule)]">{p.elo.map((e) => row(e.career, <span className="tabular-nums">{e.rating}</span>))}</dl>}
        </Section>
        <Section title="Assessments">
          {p.assessments.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">None started.</p> : <ul className="divide-y divide-[var(--m-rule)]">{p.assessments.map((a, i) => <li key={i} className="flex items-center justify-between py-2.5 font-lp-body text-[13.5px]"><span className="font-semibold text-[var(--m-ink)]">{a.layer === "GENERAL" ? "Common assessment" : a.career ?? "Role assessment"}</span><span className="flex items-center gap-2 text-[12px] text-[var(--m-muted)]">{whenTime(a.at)}<Chip tone={a.status === "COMPLETED" ? "active" : "pending"}>{humanise(a.status.toLowerCase())}</Chip></span></li>)}</ul>}
        </Section>
        <Section title="Decisions about them">
          {p.reviews.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">No admin decisions.</p> : <ul className="divide-y divide-[var(--m-rule)]">{p.reviews.map((r, i) => <li key={i} className="py-2.5 font-lp-body text-[13.5px]"><span className="flex items-center justify-between gap-2"><span className="font-semibold capitalize text-[var(--m-ink)]">{r.subject}</span><span className="flex items-center gap-2 text-[12px] text-[var(--m-muted)]">{when(r.at)}<Chip>{r.decision}</Chip></span></span>{r.reason && <span className="mt-1 block text-[12.5px] text-[var(--m-muted)]">{r.reason}</span>}</li>)}</ul>}
        </Section>
      </div>
      <div className="mt-4">
        <Section title="Recent activity" hint="The last actions this person took in the product">
          {p.events.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">No activity recorded.</p> : <ul className="grid gap-x-8 sm:grid-cols-2">{p.events.map((e, i) => <li key={i} className="flex justify-between gap-3 border-b border-[var(--m-rule)] py-2 font-lp-body text-[13px]"><span className="font-semibold capitalize text-[var(--m-ink)]">{humanise(e.name)}</span><span className="text-[var(--m-muted)]">{whenTime(e.at)}</span></li>)}</ul>}
        </Section>
      </div>
    </div>
  );
}
