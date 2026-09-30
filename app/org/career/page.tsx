import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { GOAL_KEYS } from "@/lib/org/insights";
import { isGoalKey, loadCareerIntent } from "@/lib/org/career-intent";
import { EmptyState, PageHeader, Panel, Pill, Stat } from "@/components/org/ui";

export const metadata: Metadata = { title: "Career intent — Capabilio AI" };

const GOAL_LABEL: Record<(typeof GOAL_KEYS)[number], string> = {
  job: "Placement",
  higher_studies: "Higher studies",
  entrepreneur: "Entrepreneur",
  not_sure: "Not decided",
  unset: "Not answered",
};
const GOAL_TONE = { job: "ok", higher_studies: "info", entrepreneur: "warn", not_sure: "neutral", unset: "neutral" } as const;

export default async function CareerIntentPage({ searchParams }: { searchParams: Promise<{ goal?: string; branch?: string; year?: string }> }) {
  const { ctx, service } = await orgPageContext("postPlacement");
  const sp = await searchParams;
  const goal = isGoalKey(sp.goal) ? sp.goal : undefined;
  const endYear = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : undefined;
  const { rows, counts, total, branches, years, truncated } = await loadCareerIntent(service, ctx.institutionId, { goal, branch: sp.branch || undefined, endYear });

  const href = (g?: string) => {
    const q = new URLSearchParams();
    if (g) q.set("goal", g);
    if (sp.branch) q.set("branch", sp.branch);
    if (sp.year) q.set("year", sp.year);
    const s = q.toString();
    return s ? `/org/career?${s}` : "/org/career";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Career intent"
        subtitle="What each student told Capabilio they plan to do after college. Use it to invite companies for the placement-focused students and to support the rest. Visible to your placement cell and admin only — never to companies."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {GOAL_KEYS.map((g) => (
          <Link key={g} href={href(goal === g ? undefined : g)} aria-current={goal === g} className={goal === g ? "rounded-xl ring-2 ring-app-orange" : ""}>
            <Stat label={GOAL_LABEL[g]} value={counts[g]} hint={total ? `${Math.round((counts[g] / total) * 100)}% of ${total}` : undefined} />
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filters">
        {goal && <input type="hidden" name="goal" value={goal} />}
        <label className="flex flex-col gap-1 font-lp-mono text-[11px] uppercase text-app-muted">
          Branch
          <select name="branch" defaultValue={sp.branch ?? ""} className="o-input">
            <option value="">All</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-lp-mono text-[11px] uppercase text-app-muted">
          Class of
          <select name="year" defaultValue={sp.year ?? ""} className="o-input">
            <option value="">All</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="o-btn">Apply</button>
        {(goal || sp.branch || sp.year) && (
          <Link href="/org/career" className="py-2 font-lp-body text-[13px] text-app-blue hover:underline">Clear</Link>
        )}
      </form>

      <Panel title={`${rows.length} student${rows.length === 1 ? "" : "s"}${goal ? ` · ${GOAL_LABEL[goal]}` : ""}`}>
        {rows.length === 0 ? (
          <EmptyState title="No students match" body="Students appear once they sign up with your institution's name and are active." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left font-lp-body text-[13px]">
              <thead>
                <tr className="border-b border-app-border font-lp-mono text-[11px] uppercase text-app-muted">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Class of</th>
                  <th className="py-2">Career intent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b border-app-border/60 text-app-charcoal">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3">{r.branch ?? "—"}</td>
                    <td className="py-2 pr-3">{r.endYear ?? "—"}</td>
                    <td className="py-2"><Pill tone={GOAL_TONE[r.goal]}>{GOAL_LABEL[r.goal]}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {truncated && <p className="mt-3 font-lp-body text-[12px] text-app-muted">Showing the first 1000 students. Narrow the filters to see others.</p>}
      </Panel>
    </div>
  );
}
