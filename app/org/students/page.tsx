import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { PAGE_SIZE, loadRosterOverview } from "@/lib/org/roster";
import { EmptyState, PageHeader, Pill } from "@/components/org/ui";
import { GroupTitle, Pager } from "@/components/org/widgets";
import { CohortExplorer, EloSpread, StudentCard, StudentRow, TopPerformers } from "@/components/org/StudentsParts";
import { loadCohortInsights } from "@/lib/org/roster-insights";
import { can } from "@/lib/org/roles";

export const metadata: Metadata = { title: "Students — Capabilio AI" };

type Params = { branch?: string; year?: string; q?: string; flag?: string; page?: string; view?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { ctx, service } = await orgPageContext("viewRoster");
  const sp = await searchParams;
  // year=none is the "No class" cohort (end_year not set)
  const endYear = sp.year === "none" ? null : sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : undefined;
  const flag = sp.flag === "roll" || sp.flag === "missing" ? sp.flag : undefined;
  const page = sp.page && /^\d{1,4}$/.test(sp.page) ? Number(sp.page) : 1;
  const listView = sp.view === "list";
  const o = await loadRosterOverview(service, ctx, { branch: sp.branch || undefined, endYear, q: sp.q, flag, page });
  const insights = o.total > 0 ? await loadCohortInsights(service, o.visibleIds) : null;
  const { matrix } = o;

  const href = (next: Params) => {
    const merged = { branch: sp.branch, year: sp.year, q: sp.q, flag: sp.flag, view: sp.view, ...next };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/org/students?${s}` : "/org/students";
  };
  const filtered = Boolean(sp.branch || sp.year || sp.q || flag);
  const totalAll = Object.values(matrix.branchTotals).reduce((a, b) => a + b, 0);
  const canRemove = can(ctx, "approveMembers");
  const chip = (label: string, n: number, on: boolean, to: string, tone: string) => (
    <Link href={to} aria-current={on} className={`flex items-center justify-between gap-6 rounded-xl border px-3.5 py-2.5 transition-colors hover:bg-[var(--m-accent-soft)] ${on ? "border-[var(--m-ink)] bg-[var(--m-accent-soft)]" : "border-app-border"}`}>
      <span className="text-[13px] font-semibold text-app-charcoal">{label}</span>
      <span className={`text-[18px] font-extrabold tabular-nums ${tone}`}>{n.toLocaleString("en-IN")}</span>
    </Link>
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Students"
        subtitle="Start from the whole college, then narrow to a cohort. Search by name or roll number any time."
        action={
          <form method="get" role="search" className="flex items-center gap-2">
            {sp.branch && <input type="hidden" name="branch" value={sp.branch} />}
            {sp.year && <input type="hidden" name="year" value={sp.year} />}
            {sp.view && <input type="hidden" name="view" value={sp.view} />}
            <label className="relative">
              <span className="sr-only">Search students</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" aria-hidden="true" />
              <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or roll number" className="o-input !w-64 !rounded-full !pl-9" />
            </label>
            <button type="submit" className="o-btn">
              Search
            </button>
          </form>
        }
      />

      <section aria-label="Overview" className="o-card grid gap-6 p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[12.5px] font-semibold text-app-muted">Active students</p>
            <p className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.04em] text-app-charcoal">{totalAll.toLocaleString("en-IN")}</p>
            <p className="mt-1.5 text-[12.5px] text-app-muted">across {matrix.branches.length} branch{matrix.branches.length === 1 ? "" : "es"}</p>
          </div>
          {insights && <EloSpread insights={insights} />}
        </div>
        <div className="flex flex-col gap-2.5">
          <p className="text-[13px] font-bold text-app-charcoal">Roll number check</p>
          {chip("Matched your college code", o.matched, false, href({ flag: undefined, page: undefined }), "text-app-success")}
          {chip("Not matched: follow up", o.rollFlagged, flag === "roll", href({ flag: flag === "roll" ? undefined : "roll", page: undefined }), o.rollFlagged ? "text-app-warning" : "text-app-charcoal")}
          {chip("Profile incomplete", o.incomplete, flag === "missing", href({ flag: flag === "missing" ? undefined : "missing", page: undefined }), o.incomplete ? "text-app-warning" : "text-app-charcoal")}
        </div>
      </section>

      {insights && insights.top.length > 0 && <TopPerformers top={insights.top} />}

      {matrix.branches.length > 0 && (
        <section aria-label="Cohorts">
          <GroupTitle count={matrix.branches.length}>Cohorts: branch and class of</GroupTitle>
          <CohortExplorer matrix={matrix} hrefFor={(n) => href({ branch: n.branch, year: n.year, page: undefined })} activeBranch={sp.branch} activeYear={sp.year} />
        </section>
      )}

      <section aria-label="Students">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold text-app-charcoal">
            {filtered ? `${o.total.toLocaleString("en-IN")} matching` : `All ${o.total.toLocaleString("en-IN")} students`}
          </h2>
          {sp.branch && <Pill tone="info">{sp.branch}</Pill>}
          {sp.year && <Pill tone="info">{sp.year === "none" ? "No class set" : `Class of ${sp.year}`}</Pill>}
          {sp.q && <Pill tone="info">“{sp.q}”</Pill>}
          {flag && <Pill tone="warn">{flag === "roll" ? "Roll not matched" : "Profile incomplete"}</Pill>}
          {filtered && (
            <Link href={href({ branch: undefined, year: undefined, q: undefined, flag: undefined, page: undefined })} className="text-[12.5px] font-semibold text-app-orange hover:underline">
              Clear
            </Link>
          )}
          <span className="ml-auto inline-flex overflow-hidden rounded-full border border-app-border text-[12.5px] font-semibold" role="group" aria-label="Layout">
            <Link href={href({ view: undefined, page: undefined })} aria-current={!listView} className={`px-3.5 py-1.5 ${!listView ? "bg-[var(--m-ink)] text-[var(--m-paper,#fff)]" : "text-app-muted hover:bg-[var(--m-accent-soft)]"}`}>Cards</Link>
            <Link href={href({ view: "list", page: undefined })} aria-current={listView} className={`px-3.5 py-1.5 ${listView ? "bg-[var(--m-ink)] text-[var(--m-paper,#fff)]" : "text-app-muted hover:bg-[var(--m-accent-soft)]"}`}>List</Link>
          </span>
        </div>
        {o.rows.length === 0 ? (
          <EmptyState title="No students match" body="Try another cohort above or a different search. Students appear when they sign up with your institution's exact name and are active." />
        ) : (
          <>
            {listView ? (
              <ul className="o-card ws-rows overflow-hidden">{o.rows.map((r) => <StudentRow key={r.userId} r={r} canRemove={canRemove} />)}</ul>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{o.rows.map((r) => <StudentCard key={r.userId} r={r} canRemove={canRemove} />)}</ul>
            )}
            <p className="mt-3 text-center text-[12px] text-app-muted">
              Showing {(o.page - 1) * PAGE_SIZE + 1}–{(o.page - 1) * PAGE_SIZE + o.rows.length} of {o.total.toLocaleString("en-IN")}
            </p>
            <Pager page={o.page} pageCount={o.pageCount} hrefFor={(n) => href({ page: n > 1 ? String(n) : undefined })} />
          </>
        )}
      </section>
    </div>
  );
}
