import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { loadRoster } from "@/lib/org/roster";
import { EmptyState, PageHeader, Panel } from "@/components/org/ui";

export const metadata: Metadata = { title: "Students — Capabilio AI" };

const SELECT = "o-input";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ branch?: string; year?: string }> }) {
  const { ctx, service } = await orgPageContext("viewRoster");
  const sp = await searchParams;
  const endYear = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : undefined;
  const { rows, branches, years, truncated } = await loadRoster(service, ctx, { branch: sp.branch || undefined, endYear });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Students"
        subtitle="Students who signed up under your institution's name. The figures are counts of real activity — no rating is shown, and Arena results stay private to each student unless they share their Portfolio."
      />
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filters">
        <label className="flex flex-col gap-1 font-lp-mono text-[11px] uppercase text-app-muted">
          Branch
          <select name="branch" defaultValue={sp.branch ?? ""} className={SELECT}>
            <option value="">All</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-lp-mono text-[11px] uppercase text-app-muted">
          Class of
          <select name="year" defaultValue={sp.year ?? ""} className={SELECT}>
            <option value="">All</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="o-btn">
          Apply
        </button>
        {(sp.branch || sp.year) && (
          <Link href="/org/students" className="py-2 font-lp-body text-[13px] text-app-blue hover:underline">
            Clear
          </Link>
        )}
      </form>
      <Panel title={`${rows.length} student${rows.length === 1 ? "" : "s"}`}>
        {rows.length === 0 ? (
          <EmptyState title="No students match" body="Students appear when they sign up with your institution's exact name and are active." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left font-lp-body text-[13px]">
              <thead>
                <tr className="border-b border-app-border font-lp-mono text-[11px] uppercase text-app-muted">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Roll number</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Class of</th>
                  <th className="py-2 pr-3">Project groups</th>
                  <th className="py-2 pr-3">Staff-graded projects</th>
                  <th className="py-2">Arena (30 days)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b border-app-border/60 text-app-charcoal">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3">
                      {r.rollNumber ?? "—"}
                      {r.rollStatus === "flagged" && (
                        <span className="ml-2 rounded bg-app-warning-container px-1.5 py-0.5 font-lp-mono text-[10px] uppercase text-app-charcoal" title="Roll number is missing or doesn't start with your college code">
                          Not matched
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{r.branch ?? "—"}</td>
                    <td className="py-2 pr-3">{r.endYear ?? "—"}</td>
                    <td className="py-2 pr-3">{r.groups}</td>
                    <td className="py-2 pr-3">{r.gradedProjects}</td>
                    <td className="py-2">{r.arenaLast30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {truncated && <p className="mt-3 font-lp-body text-[12px] text-app-muted">Showing the first 500 students. Narrow the filters to see others.</p>}
      </Panel>
    </div>
  );
}
