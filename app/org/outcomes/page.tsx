import type { Metadata } from "next";
import { Download } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { loadOutcomes } from "@/lib/org/outcomes";
import { MIN_COHORT } from "@/lib/org/insights";
import { JsonForm } from "@/components/org/JsonForm";
import { Collapsible, EmptyState, PageHeader, Panel, Pill, Stat } from "@/components/org/ui";

export const metadata: Metadata = { title: "Outcomes — Capabilio AI" };

export default async function OutcomesPage() {
  const { ctx, service } = await orgPageContext("viewOutcomes");
  const { placements, stats, funnel, driveCount } = await loadOutcomes(service, ctx.institutionId);
  const { data: students } = await service
    .from("institution_memberships")
    .select("user_id, branch")
    .eq("institution_id", ctx.institutionId)
    .eq("role", "student")
    .eq("status", "active")
    .limit(500);
  const ids = (students ?? []).map((s) => s.user_id);
  const { data: profiles } = ids.length ? await service.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const options = (profiles ?? []).map((p) => ({ value: p.id, label: p.full_name ?? p.email })).sort((a, b) => a.label.localeCompare(b.label));

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
        <Stat label="Students placed" value={stats.placed} />
        <Stat label="Companies" value={stats.companies} />
        <Stat label="Average CTC" value={stats.ctc ? `${stats.ctc.average} LPA` : "—"} hint={stats.ctc ? `median ${stats.ctc.median} · highest ${stats.ctc.highest}` : `shown at ${MIN_COHORT}+ offers with a CTC`} />
        <Stat label="Company visits" value={driveCount} />
      </div>

      <Panel title="Placement funnel (company visits)">
        <ul className="flex flex-col gap-2">
          {stages.map((s) => (
            <li key={s.label} className="flex items-center gap-3">
              <span className="w-44 shrink-0 font-lp-body text-[13px] text-app-charcoal">{s.label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                <span className="block h-full rounded-full bg-app-orange" style={{ width: `${(s.value / top) * 100}%` }} />
              </span>
              <span className="w-10 text-right font-lp-mono text-[12px] text-app-charcoal">{s.value}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="By branch">
        {stats.byBranch.length === 0 ? (
          <p className="font-lp-body text-[12.5px] text-app-muted">No confirmed placements yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {stats.byBranch.map((b) => (
              <li key={b.branch} className="rounded-full border border-app-border px-3 py-1 font-lp-body text-[12.5px] text-app-charcoal">
                {b.branch}: {b.count ?? `fewer than ${MIN_COHORT}`}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Confirmed placements">
        {placements.length === 0 ? (
          <EmptyState title="No confirmed placements" body="Select an applicant on a drive and confirm the placement, or record an off-campus offer below." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left font-lp-body text-[13px]">
              <thead>
                <tr className="border-b border-app-border font-lp-mono text-[11px] uppercase text-app-muted">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">CTC (LPA)</th>
                  <th className="py-2 pr-3">Student&apos;s answer</th>
                  <th className="py-2 pr-3">Letter</th>
                  <th className="py-2">Public wall</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((p) => (
                  <tr key={p.id} className="border-b border-app-border/60 text-app-charcoal">
                    <td className="py-2 pr-3 font-medium">{p.studentName}</td>
                    <td className="py-2 pr-3">{p.branch ?? "—"}</td>
                    <td className="py-2 pr-3">{p.company}</td>
                    <td className="py-2 pr-3">{p.roleTitle}</td>
                    <td className="py-2 pr-3">{p.ctcLpa ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Pill tone={p.studentResponse === "accepted" ? "ok" : p.studentResponse === "declined" ? "neutral" : "warn"}>{p.studentResponse === "accepted" ? "Accepted" : p.studentResponse === "declined" ? "Declined" : "Waiting"}</Pill>
                    </td>
                    <td className="py-2 pr-3">
                      {p.hasLetter ? (
                        <a href={`/api/offer-letter/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">{p.showOnWall ? <Pill tone="ok">Student agreed</Pill> : <Pill>Not shown</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Collapsible title="Record an off-campus offer">
        <p className="mb-3 font-lp-body text-[12.5px] text-app-muted">For a placement that didn&apos;t come through one of your drives. It counts only because you confirm it here.</p>
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
    </div>
  );
}
