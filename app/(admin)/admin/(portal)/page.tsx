import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/admin/permissions";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import { loadOverview } from "@/lib/admin/overview";
import { Bars, Delta, PageHeader, Section, Spark, Stat, CARD, humanise } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "–");

/** The whole ecosystem on one screen: who is here, what is waiting for a decision, how people move through the product, and what needs attention. */
export default async function AdminOverview() {
  const admin = await requireAdminPage();
  if (!can(admin, "view")) redirect(homeFor(admin)); // support has no Overview
  const o = await loadOverview();
  const waiting = o.approvals.mentors + o.approvals.organisations + o.approvals.executives;
  const top = Math.max(1, o.funnel[0]?.value ?? 1);
  return (
    <div>
      <PageHeader eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} title="The ecosystem, today" intro="Everyone on Capabilio and what they are doing, with what needs a decision first." />

      {o.alerts.length > 0 && (
        <ul className="mb-6 flex flex-col gap-2" aria-label="Needs attention">
          {o.alerts.map((a) => (
            <li key={a.text}>
              <Link href={a.href} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-lp-body text-[13.5px] font-semibold transition-colors ${a.level === "warn" ? "border-[#f3d28a] bg-[#fff6e0] text-[#6b4a00] hover:bg-[#ffefc4]" : "border-[var(--m-rule)] bg-white text-[var(--m-ink)] hover:border-[var(--m-ink)]"}`}>
                {a.level === "warn" ? <AlertTriangle size={16} aria-hidden /> : <Info size={16} aria-hidden />}{a.text}<ArrowRight size={15} aria-hidden className="ml-auto" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="ink" label="People" value={o.people.total} sub={`${o.signups.last7} joined in the last 7 days`} href="/admin/people">
          <div className="mt-3"><Delta now={o.signups.last7} before={o.signups.prev7} /></div>
        </Stat>
        <Stat label="Waiting for you" tone={waiting > 0 ? "accent" : "plain"} value={waiting} sub={waiting ? `${o.approvals.mentors} mentors · ${o.approvals.organisations} organisations · ${o.approvals.executives} executives` : "Nothing waiting"} href="/admin/approvals" />
        <Stat label="Colleges" value={o.colleges.total} sub={`${o.colleges.students} students enrolled`} href="/admin/colleges" />
        <Stat label="Companies" value={o.companies.total} sub={`${o.companies.openings} jobs posted · ${o.companies.hired} hired`} href="/admin/companies" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={o.people.students} href="/admin/people?kind=student" />
        <Stat label="Graduates" value={o.people.graduates} href="/admin/people?kind=graduate" />
        <Stat label="Professionals" value={o.people.professionals} sub={`${o.professionals.epfoVerified} EPFO verified`} href="/admin/professionals" />
        <Stat label="Others" value={o.people.others} sub="no path chosen yet" href="/admin/people?kind=other" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Sign-ups, last 30 days" hint={`${o.signups.counts.reduce((a, b) => a + b, 0)} new accounts`}>
            <Spark values={o.signups.counts} label="Sign-ups per day over the last 30 days" className="h-24" />
            <div className="mt-1 flex justify-between font-lp-body text-[11.5px] text-[var(--m-muted)]"><span>{o.signups.days[0]}</span><span>today</span></div>
          </Section>
        </div>
        <Section title="Professionals" hint="Verification and mentoring">
          <Bars total={Math.max(1, o.professionals.total)} rows={[
            { label: "EPFO verified", value: o.professionals.epfoVerified, note: pct(o.professionals.epfoVerified, o.professionals.total) },
            { label: "Verification pending", value: o.professionals.pending },
            { label: "Interested in mentoring", value: o.professionals.mentorInterested },
            { label: "Approved mentors", value: o.professionals.mentorsApproved },
          ]} />
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Where students drop off" hint="From sign-up to a finished role assessment">
          <ul className="flex flex-col gap-3">
            {o.funnel.map((f, i) => (
              <li key={f.label}>
                <div className="flex items-baseline justify-between font-lp-body text-[13px]"><span className="font-semibold text-[var(--m-ink)]">{f.label}</span><span className="tabular-nums text-[var(--m-muted)]">{f.value}{i > 0 ? ` · ${pct(f.value, top)}` : ""}</span></div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-[var(--m-ground)]"><div className="h-full rounded-full bg-[var(--m-ink)]" style={{ width: `${Math.max(2, Math.round((f.value / top) * 100))}%`, opacity: 1 - i * 0.14 }} /></div>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="What people did this week" hint="Most frequent actions in the product" action={<Link href="/admin/activity" className="font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">All activity</Link>}>
          <Bars rows={o.topEvents.map((e) => ({ label: humanise(e.name), value: e.count }))} empty="No activity recorded this week." />
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Section title="Hiring through Capabilio">
          <dl className="grid grid-cols-2 gap-3 font-lp-body">
            {([["Companies", o.companies.total], ["Jobs posted", o.companies.openings], ["Open now", o.companies.openNow], ["Applications", o.companies.applications], ["Hired", o.companies.hired]] as const).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-[var(--m-ground)]/70 p-3"><dd className="font-lp-display text-[24px] font-bold tabular-nums text-[var(--m-ink)]">{v}</dd><dt className="text-[12px] text-[var(--m-muted)]">{k}</dt></div>
            ))}
          </dl>
        </Section>
        <Section title="Executive path" hint="Not open yet">
          <p className="font-lp-display text-[34px] font-bold tabular-nums text-[var(--m-ink)]">{o.executives.waitlist}</p>
          <p className="font-lp-body text-[13px] text-[var(--m-muted)]">on the early-access list · {o.executives.accounts} accounts</p>
          <Link href="/admin/executives" className="mt-3 inline-flex items-center gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">Review them <ArrowRight size={14} aria-hidden /></Link>
        </Section>
        <Section title="AI usage, 7 days">
          <p className="font-lp-display text-[34px] font-bold tabular-nums text-[var(--m-ink)]">{o.ai.calls.toLocaleString("en-IN")}</p>
          <p className="font-lp-body text-[13px] text-[var(--m-muted)]">calls · {o.ai.failures} failed · about ${(o.ai.costCents / 100).toFixed(2)} estimated (as recorded per call)</p>
          <Link href="/admin/activity" className="mt-3 inline-flex items-center gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">By feature <ArrowRight size={14} aria-hidden /></Link>
        </Section>
      </div>
      <p className={`${CARD} mt-6 px-5 py-4 font-lp-body text-[12.5px] text-[var(--m-muted)]`}>Numbers are read live from the database each time this page opens. Nothing here is estimated except the AI cost, which uses the cost recorded per call.</p>
    </div>
  );
}
