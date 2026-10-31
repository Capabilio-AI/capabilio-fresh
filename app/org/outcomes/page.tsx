import type { Metadata } from "next";
import { Download } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { can } from "@/lib/org/roles";
import { loadOutcomes, searchStudentOptions } from "@/lib/org/outcomes";
import { MIN_COHORT } from "@/lib/org/insights";
import { JsonForm } from "@/components/org/JsonForm";
import { Collapsible, EmptyState, PageHeader, Pill } from "@/components/org/ui";
import { Fact, GroupTitle, Initial, Meter } from "@/components/org/widgets";

export const metadata: Metadata = { title: "Outcomes — Capabilio AI" };

export default async function OutcomesPage({ searchParams }: { searchParams: Promise<{ pq?: string }> }) {
  const { ctx, service } = await orgPageContext("viewOutcomes");
  const { pq } = await searchParams;
  const canPost = can(ctx, "postPlacement");
  // the student picker is searched by name, and only loaded when someone who can record an offer is looking for a student
  const [{ placements, stats, funnel, driveCount }, options] = await Promise.all([
    loadOutcomes(service, ctx.institutionId),
    canPost && pq?.trim() ? searchStudentOptions(service, ctx.institutionId, pq) : Promise.resolve([]),
  ]);

  const stages = [
    { label: "Registered for visits", value: funnel.applied },
    { label: "Shortlisted", value: funnel.shortlisted },
    { label: "Selected", value: funnel.selected },
    { label: "Placements confirmed", value: funnel.placed },
  ];
  const top = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Outcomes"
        subtitle="Only placements confirmed by your team are counted — there is no self-reporting. Averages and per-branch counts are hidden until there are at least 5 records, so no single student's offer can be inferred."
        action={
          placements.length > 0 && (
            <a href="/api/org/outcomes/export" className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-[var(--o-pop)] px-3 py-2 font-lp-body text-[13px] font-medium text-app-charcoal hover:bg-white/5">
              <Download size={14} /> Export CSV
            </a>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact label="Students placed" value={stats.placed} tone="text-app-success" />
        <Fact label="Companies" value={stats.companies} />
        <Fact label="Average CTC" value={stats.ctc ? `${stats.ctc.average} LPA` : "—"} hint={stats.ctc ? `median ${stats.ctc.median} · highest ${stats.ctc.highest}` : `shown at ${MIN_COHORT}+ offers with a CTC`} />
        <Fact label="Company visits" value={driveCount} />
      </div>

      <section aria-label="Placement funnel">
        <GroupTitle>From registration to offer</GroupTitle>
        <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stages.map((s, i) => (
            <li key={s.label} className="o-card p-4">
              <p className="text-[12.5px] font-semibold text-app-muted">{s.label}</p>
              <p className="mt-1 text-[28px] font-extrabold leading-none tracking-[-0.03em] text-app-charcoal">{s.value}</p>
              <div className="mt-3">
                <Meter value={s.value} max={top} label={s.label} tone={i === stages.length - 1 ? "ok" : "gold"} />
              </div>
              <p className="mt-1.5 text-[12px] text-app-muted">{i === 0 ? "Start of the funnel" : stages[i - 1].value > 0 ? `${Math.round((s.value / stages[i - 1].value) * 100)}% of the step before` : "—"}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="By branch">
        <GroupTitle>By branch</GroupTitle>
        {stats.byBranch.length === 0 ? (
          <p className="text-[12.5px] text-app-muted">No confirmed placements yet.</p>
        ) : (
          <ul className="o-card ws-rows overflow-hidden">
            {stats.byBranch.map((b) => (
              <li key={b.branch} className="flex items-center gap-3 px-4 py-3">
                <span className="w-56 shrink-0 truncate text-[13.5px] font-semibold text-app-charcoal">{b.branch}</span>
                <span className="flex-1">
                  {b.count !== null && b.count !== undefined ? <Meter value={b.count} max={Math.max(1, ...stats.byBranch.map((x) => x.count ?? 0))} label={b.branch} tone="ok" /> : <span className="text-[12px] text-app-muted">Fewer than {MIN_COHORT}, hidden for privacy</span>}
                </span>
                <span className="w-8 text-right text-[13px] font-bold text-app-charcoal">{b.count ?? "–"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Confirmed placements">
        <GroupTitle count={placements.length}>Selected students (on campus and confirmed)</GroupTitle>
        {placements.length === 0 ? (
          <EmptyState title="No confirmed placements" body="Select an applicant on a drive and confirm the placement, or record an off-campus offer below." />
        ) : (
          <ul className="o-card ws-rows overflow-hidden">
            {placements.map((p) => (
              <li key={p.id} className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-3 px-4 py-3 md:grid-cols-[42px_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
                  <img src={p.avatarUrl} alt="" className="h-[42px] w-[42px] rounded-full object-cover" />
                ) : (
                  <Initial text={p.studentName} size={42} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-app-charcoal">{p.studentName}</p>
                  <p className="truncate text-[12.5px] text-app-muted">{[p.rollNumber, p.branch ?? "Branch not set", p.endYear ? `Class of ${p.endYear}` : null].filter(Boolean).join(" · ")}</p>
                  {p.email && <p className="truncate text-[12px] text-app-muted">{p.email}</p>}
                </div>
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-[13.5px] font-semibold text-app-charcoal">{p.company}</p>
                  <p className="truncate text-[12.5px] text-app-muted">
                    {p.roleTitle}
                    {p.ctcLpa ? ` · ${p.ctcLpa} LPA` : ""}
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:justify-end">
                  <Pill tone={p.studentResponse === "accepted" ? "ok" : p.studentResponse === "declined" ? "neutral" : "warn"}>{p.studentResponse === "accepted" ? "Accepted" : p.studentResponse === "declined" ? "Declined" : "Waiting"}</Pill>
                  {p.showOnWall && <Pill tone="ok">On wall</Pill>}
                  {p.hasLetter && (
                    <a href={`/api/offer-letter/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-app-orange hover:underline">
                      Letter
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canPost && (
      <Collapsible title="Record an off-campus offer" defaultOpen={Boolean(pq?.trim())}>
        <p className="mb-3 font-lp-body text-[12.5px] text-app-muted">For a placement that didn&apos;t come through one of your drives. It counts only because you confirm it here.</p>
        <form method="get" role="search" className="mb-3 flex items-center gap-2">
          <label className="sr-only" htmlFor="pq">Find the student by name or email</label>
          <input id="pq" name="pq" defaultValue={pq ?? ""} placeholder="Find the student by name or email" className="o-input !w-72" />
          <button type="submit" className="o-btn">Find</button>
        </form>
        {pq?.trim() && options.length === 0 && <p className="mb-3 text-[12.5px] text-app-muted">No student at your college matches “{pq.trim()}”.</p>}
        <JsonForm
          action="/api/org/placements/confirm"
          submitLabel="Confirm placement"
          successMessage="Placement confirmed."
          fields={[
            { name: "studentUserId", label: "Student", type: "select", required: true, options },
            { name: "company", label: "Company", required: true },
            { name: "roleTitle", label: "Role", required: true },
            { name: "ctcLpa", label: "CTC (LPA)", type: "number" },
            { name: "offerDate", label: "Offer date", type: "date" },
          ]}
        />
      </Collapsible>
      )}
    </div>
  );
}
