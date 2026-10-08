import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { GOAL_KEYS } from "@/lib/org/insights";
import { isGoalKey, loadCareerIntent } from "@/lib/org/career-intent";
import { EmptyState, PageHeader, Pill } from "@/components/org/ui";
import { GroupTitle, Initial, Pager, StackBar } from "@/components/org/widgets";

export const metadata: Metadata = { title: "Career intent — Capabilio AI" };

const GOAL_LABEL: Record<(typeof GOAL_KEYS)[number], string> = {
  job: "Placement",
  higher_studies: "Higher studies",
  entrepreneur: "Entrepreneur",
  not_sure: "Not decided",
  unset: "Not answered",
};
const GOAL_COLOR: Record<(typeof GOAL_KEYS)[number], string> = { job: "var(--app-success)", higher_studies: "var(--app-blue)", entrepreneur: "#e0a30c", not_sure: "#a39770", unset: "#d9cba3" };
const GOAL_TONE = { job: "ok", higher_studies: "info", entrepreneur: "warn", not_sure: "neutral", unset: "neutral" } as const;

export default async function CareerIntentPage({ searchParams }: { searchParams: Promise<{ goal?: string; branch?: string; year?: string; page?: string }> }) {
  const { ctx, service } = await orgPageContext("postPlacement");
  const sp = await searchParams;
  const goal = isGoalKey(sp.goal) ? sp.goal : undefined;
  const endYear = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : undefined;
  const { rows, counts, total, branches, years, truncated } = await loadCareerIntent(service, ctx.institutionId, { goal, branch: sp.branch || undefined, endYear });

  const page = sp.page && /^\d{1,4}$/.test(sp.page) ? Number(sp.page) : 1;
  const pageCount = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pageCount);
  const shown = rows.slice((current - 1) * 25, current * 25);
  const href = (g?: string, p?: number) => {
    const q = new URLSearchParams();
    if (g) q.set("goal", g);
    if (p && p > 1) q.set("page", String(p));
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

      <section className="o-card p-5" aria-label="Career intent split">
        <GroupTitle>{total.toLocaleString("en-IN")} students, by what they plan next</GroupTitle>
        <StackBar
          total={total}
          parts={GOAL_KEYS.map((g) => ({ key: g, label: GOAL_LABEL[g], value: counts[g], color: GOAL_COLOR[g], href: href(goal === g ? undefined : g), active: goal === g }))}
        />
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filters">
        {goal && <input type="hidden" name="goal" value={goal} />}
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-app-muted">
          Branch
          <select name="branch" defaultValue={sp.branch ?? ""} className="o-input">
            <option value="">All</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-app-muted">
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

      <section aria-label="Students">
        <GroupTitle count={rows.length}>{goal ? GOAL_LABEL[goal] : "All students"}</GroupTitle>
        {rows.length === 0 ? (
          <EmptyState title="No students match" body="Students appear once they sign up with your institution's name and are active." />
        ) : (
          <>
            <ul className="o-card ws-rows overflow-hidden">
              {shown.map((r) => (
                <li key={r.userId} className="flex items-center gap-3 px-4 py-3">
                  <Initial text={r.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-app-charcoal">{r.name}</p>
                    <p className="truncate text-[12.5px] text-app-muted">
                      {r.branch ?? "Branch not set"}
                      {r.endYear ? ` · Class of ${r.endYear}` : ""}
                    </p>
                  </div>
                  <Pill tone={GOAL_TONE[r.goal]}>{GOAL_LABEL[r.goal]}</Pill>
                </li>
              ))}
            </ul>
            <Pager page={current} pageCount={pageCount} hrefFor={(n) => href(goal, n)} />
          </>
        )}
        {truncated && <p className="mt-3 text-[12px] text-app-muted">Showing the first 1000 students. Narrow the filters to see others.</p>}
      </section>
    </div>
  );
}
