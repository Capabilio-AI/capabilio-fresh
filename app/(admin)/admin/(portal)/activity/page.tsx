import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import { loadActivity } from "@/lib/admin/activity";
import { Bars, Empty, PageHeader, Section, Spark, Stat, Table, TD, humanise, whenTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** What people are doing, how tests are behaving, and what the AI features cost and how they fail. */
export default async function Activity() {
  const admin = await requireAdminPage("view"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const a = await loadActivity();
  const calls = a.ai.reduce((n, r) => n + r.calls, 0);
  const fails = a.ai.reduce((n, r) => n + r.failures, 0);
  return (
    <div>
      <PageHeader eyebrow="Monitoring" title="Activity" intro="The last 7 days of the product: what people do, how proctored tests behave, and how the AI features perform." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="ink" label="Active today" value={a.activeUsers.day} sub={`${a.activeUsers.week} in the last 7 days`} />
        <Stat label="Actions, 7 days" value={a.perDay.counts.reduce((x, y) => x + y, 0).toLocaleString("en-IN")} />
        <Stat label="Integrity events" value={a.integrity.reduce((n, r) => n + r.count, 0)} sub="full-screen exits, tab switches, blocked keys" />
        <Stat label="AI calls" value={calls.toLocaleString("en-IN")} sub={`${fails} failed`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><Section title="Actions per day"><Spark values={a.perDay.counts} label="Actions per day over the last 7 days" className="h-24" /><div className="mt-1 flex justify-between font-lp-body text-[11.5px] text-[var(--m-muted)]"><span>{a.perDay.days[0]}</span><span>today</span></div></Section></div>
        <Section title="Test integrity" hint="By kind"><Bars rows={a.integrity.map((r) => ({ label: humanise(r.kind), value: r.count }))} empty="No integrity events." /></Section>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Most common actions"><Bars rows={a.top.map((r) => ({ label: humanise(r.name), value: r.count, note: `${r.users} people` }))} empty="No activity this week." /></Section>
        <Section title="Latest actions" hint="Newest first">
          {a.events.length === 0 ? <p className="font-lp-body text-[13px] text-[var(--m-muted)]">Nothing yet.</p> : <ul className="max-h-[360px] divide-y divide-[var(--m-rule)] overflow-y-auto">{a.events.map((e, i) => <li key={i} className="flex justify-between gap-3 py-2 font-lp-body text-[13px]"><span className="min-w-0 truncate"><span className="font-semibold capitalize text-[var(--m-ink)]">{humanise(e.name)}</span><span className="text-[var(--m-muted)]"> · {e.who ?? "system"}</span></span><span className="shrink-0 text-[var(--m-muted)]">{whenTime(e.at)}</span></li>)}</ul>}
        </Section>
      </div>
      <h2 className="mb-3 mt-8 font-lp-display text-[20px] font-bold text-[var(--m-ink)]">AI features</h2>
      {a.ai.length === 0 ? <Empty title="No AI calls this week" /> : (
        <Table head={["Feature", "Calls", "Failed", "Avg time", "Cost (est.)"]}>
          {a.ai.map((r) => <tr key={r.feature}><td className={`${TD} font-bold`}>{humanise(r.feature)}</td><td className={`${TD} tabular-nums`}>{r.calls}</td><td className={`${TD} tabular-nums ${r.failures ? "font-bold text-[#8e1228]" : ""}`}>{r.failures}</td><td className={`${TD} tabular-nums`}>{(r.avgMs / 1000).toFixed(1)}s</td><td className={`${TD} tabular-nums`}>${(r.costCents / 100).toFixed(2)}</td></tr>)}
        </Table>
      )}
      {a.aiErrors.length > 0 && <div className="mt-4"><Section title="Recent AI failures"><ul className="divide-y divide-[var(--m-rule)]">{a.aiErrors.map((e, i) => <li key={i} className="py-2 font-lp-body text-[13px]"><span className="font-bold text-[var(--m-ink)]">{humanise(e.feature)}</span> <span className="text-[var(--m-muted)]">{whenTime(e.at)}</span><span className="block text-[12.5px] text-[#8e1228]">{e.error ?? "No message"}</span></li>)}</ul></Section></div>}
      {a.integrityRecent.length > 0 && <div className="mt-4"><Section title="Latest integrity events"><ul className="divide-y divide-[var(--m-rule)]">{a.integrityRecent.map((e, i) => <li key={i} className="flex justify-between gap-3 py-2 font-lp-body text-[13px]"><span><span className="font-semibold text-[var(--m-ink)]">{e.who ?? "Unknown"}</span> · {humanise(e.kind)} ×{e.n} <span className="text-[var(--m-muted)]">in {e.area}</span></span><span className="text-[var(--m-muted)]">{whenTime(e.at)}</span></li>)}</ul></Section></div>}
    </div>
  );
}
