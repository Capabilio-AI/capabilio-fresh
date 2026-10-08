import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { PAGE_SIZE, cellKey, loadRosterOverview } from "@/lib/org/roster";
import { EmptyState, PageHeader, Pill } from "@/components/org/ui";
import { Fact, GroupTitle, Initial, Pager } from "@/components/org/widgets";

export const metadata: Metadata = { title: "Students — Capabilio AI" };

type Params = { branch?: string; year?: string; q?: string; flag?: string; page?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { ctx, service } = await orgPageContext("viewRoster");
  const sp = await searchParams;
  const endYear = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : undefined;
  const flag = sp.flag === "roll" || sp.flag === "missing" ? sp.flag : undefined;
  const page = sp.page && /^\d{1,4}$/.test(sp.page) ? Number(sp.page) : 1;
  const o = await loadRosterOverview(service, ctx, { branch: sp.branch || undefined, endYear, q: sp.q, flag, page });
  const { matrix } = o;

  const href = (next: Params) => {
    const merged = { branch: sp.branch, year: sp.year, q: sp.q, flag: sp.flag, ...next };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/org/students?${s}` : "/org/students";
  };
  const filtered = Boolean(sp.branch || sp.year || sp.q || flag);
  const totalAll = Object.values(matrix.branchTotals).reduce((a, b) => a + b, 0);
  const peak = Math.max(1, ...Object.values(matrix.cells));
  const shade = (n: number) => (n === 0 ? "transparent" : `rgba(224, 163, 12, ${0.14 + 0.62 * (n / peak)})`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Students"
        subtitle="Find a cohort, not a long list. Pick a branch and class on the grid, or search by name or roll number. Figures are counts of real activity; Arena results stay private to each student."
        action={
          <form method="get" role="search" className="flex items-center gap-2">
            {sp.branch && <input type="hidden" name="branch" value={sp.branch} />}
            {sp.year && <input type="hidden" name="year" value={sp.year} />}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact label="Active students" value={totalAll.toLocaleString("en-IN")} hint={`${matrix.branches.length} branch${matrix.branches.length === 1 ? "" : "es"}`} href="/org/students" />
        <Fact label="Roll number matched" value={o.matched.toLocaleString("en-IN")} hint="Starts with your college code" tone="text-app-success" />
        <Fact label="Roll number not matched" value={o.rollFlagged.toLocaleString("en-IN")} hint="Open the list to follow up" href={href({ flag: flag === "roll" ? undefined : "roll", page: undefined })} tone={o.rollFlagged ? "text-app-warning" : "text-app-charcoal"} />
        <Fact label="Profile incomplete" value={o.incomplete.toLocaleString("en-IN")} hint="Branch, class or roll number missing" href={href({ flag: flag === "missing" ? undefined : "missing", page: undefined })} tone={o.incomplete ? "text-app-warning" : "text-app-charcoal"} />
      </div>

      {matrix.branches.length > 0 && (
        <section aria-label="Cohort grid">
          <GroupTitle>Cohorts: branch by class of</GroupTitle>
          <div className="o-card overflow-x-auto p-3">
            <table className="w-full min-w-[520px] border-separate border-spacing-1 text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-app-muted">
                  <th className="px-2 py-1 font-semibold">Branch</th>
                  {matrix.years.map((y) => (
                    <th key={String(y)} className="px-2 py-1 text-center font-semibold">
                      <Link href={href({ year: y ? String(y) : undefined, branch: undefined, page: undefined })} className="hover:underline">
                        {y ?? "No class"}
                      </Link>
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right font-semibold">All</th>
                </tr>
              </thead>
              <tbody>
                {matrix.branches.map((b) => (
                  <tr key={b}>
                    <th scope="row" className="max-w-[16rem] truncate px-2 py-1 font-semibold text-app-charcoal">
                      <Link href={href({ branch: b, year: undefined, page: undefined })} className="hover:underline" title={b}>
                        {b}
                      </Link>
                    </th>
                    {matrix.years.map((y) => {
                      const n = matrix.cells[cellKey(b, y)] ?? 0;
                      const on = sp.branch === b && String(y ?? "") === (sp.year ?? "");
                      return (
                        <td key={String(y)} className="p-0">
                          {n > 0 ? (
                            <Link
                              href={href({ branch: b, year: y ? String(y) : undefined, page: undefined })}
                              aria-label={`${b}, class of ${y ?? "not set"}: ${n} students`}
                              aria-current={on}
                              className={`block rounded-lg px-2 py-2 text-center text-[13px] font-extrabold text-app-charcoal transition-transform hover:scale-[1.04] ${on ? "ring-2 ring-[var(--m-ink)]" : ""}`}
                              style={{ background: shade(n) }}
                            >
                              {n.toLocaleString("en-IN")}
                            </Link>
                          ) : (
                            <span className="block px-2 py-2 text-center text-app-muted/50" aria-hidden="true">
                              ·
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-bold text-app-muted">{matrix.branchTotals[b].toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-label="Students">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold text-app-charcoal">
            {filtered ? `${o.total.toLocaleString("en-IN")} matching` : `All ${o.total.toLocaleString("en-IN")} students`}
          </h2>
          {sp.branch && <Pill tone="info">{sp.branch}</Pill>}
          {sp.year && <Pill tone="info">Class of {sp.year}</Pill>}
          {sp.q && <Pill tone="info">“{sp.q}”</Pill>}
          {flag && <Pill tone="warn">{flag === "roll" ? "Roll not matched" : "Profile incomplete"}</Pill>}
          {filtered && (
            <Link href="/org/students" className="text-[12.5px] font-semibold text-app-orange hover:underline">
              Clear
            </Link>
          )}
        </div>
        {o.rows.length === 0 ? (
          <EmptyState title="No students match" body="Try another cohort on the grid or a different search. Students appear when they sign up with your institution's exact name and are active." />
        ) : (
          <>
            <ul className="o-card ws-rows overflow-hidden">
              {o.rows.map((r) => (
                <li key={r.userId} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3 px-4 py-3 md:grid-cols-[36px_minmax(0,1.4fr)_minmax(0,1.2fr)_auto]">
                  <Initial text={r.name} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-app-charcoal">{r.name}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-app-muted">
                      <span>{r.rollNumber ?? "No roll number"}</span>
                      {r.rollStatus === "flagged" && <Pill tone="warn">Not matched</Pill>}
                    </p>
                  </div>
                  <p className="hidden min-w-0 truncate text-[12.5px] text-app-muted md:block">
                    {r.branch ?? "Branch not set"}
                    {r.endYear ? ` · Class of ${r.endYear}` : ""}
                  </p>
                  <p className="col-span-2 flex flex-wrap gap-1.5 md:col-span-1 md:justify-end">
                    <Pill tone={r.groups ? "info" : "neutral"}>{r.groups} group{r.groups === 1 ? "" : "s"}</Pill>
                    <Pill tone={r.gradedProjects ? "ok" : "neutral"}>{r.gradedProjects} graded</Pill>
                    <Pill tone={r.arenaLast30 ? "ok" : "neutral"}>{r.arenaLast30} Arena · 30d</Pill>
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-center text-[12px] text-app-muted">
              Showing {(o.page - 1) * PAGE_SIZE + 1}–{(o.page - 1) * PAGE_SIZE + o.rows.length} of {o.total.toLocaleString("en-IN")}
            </p>
            <Pager page={o.page} pageCount={o.pageCount} hrefFor={(n) => href({ page: n > 1 ? String(n) : undefined })} />
          </>
        )}
      </section>
    </div>
  );
}
