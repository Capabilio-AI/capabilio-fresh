import { Code2, FileText, Folder, FolderOpen, ListChecks } from "lucide-react";
import { Reveal, SectionLabel } from "./ui";

const TABS = ["Overview", "Team Roster", "Tasks (Kanban)", "Code Workspace", "Evidence Vault", "Documentation", "Mentor Evaluation"];

const TESTS = [
  "test_rolling_window_bounds",
  "test_partition_independence",
  "test_null_sales_handling",
  "test_index_scan_performance",
];

const CONTRIBUTORS = [
  { initials: "AR", tone: "bg-lp-text-ink" },
  { initials: "DK", tone: "bg-lp-accent-ochre" },
  { initials: "ML", tone: "bg-lp-accent-indigo" },
];

function SqlLine({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

const KW = "text-lp-accent-ochre font-bold";
const FN = "text-lp-accent-indigo font-bold";

export default function ProjectLab() {
  return (
    <section className="w-full border-y border-lp-border-hairline bg-lp-surface px-margin-mobile py-space-2xl md:px-margin" id="project-lab">
      <div className="mx-auto flex max-w-7xl flex-col gap-space-xl">
        <Reveal className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel tone="ochre">Production Environments</SectionLabel>
            <h2 className="mt-1 font-lp-display text-lp-display-mobile tracking-tight text-lp-text-ink md:text-lp-headline-lg lg:text-lp-display">
              Learning becomes valuable when you build.
            </h2>
          </div>
          <p className="max-w-md font-lp-body text-lp-body-sm text-lp-text-muted">
            Capabilio projects are not toy tutorials. They run inside live containerized
            sandboxes with multi-member teams, version control, and mentor evaluations.
          </p>
        </Reveal>

        <Reveal className="overflow-hidden rounded-xl border border-lp-border-hairline bg-lp-surface-card shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-lp-border-hairline bg-lp-surface-subtle px-space-md py-3">
            <div className="flex items-center gap-space-md">
              <span className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                Project: Retail Sales Intelligence
              </span>
              <span className="rounded border border-lp-border-hairline bg-lp-surface-card px-2 py-0.5 font-lp-mono text-lp-label-sm text-lp-text-muted">
                Team: 4 engineers · Mentor: Sarah Lin (Staff Eng)
              </span>
            </div>
            <div className="flex items-center gap-2 font-lp-mono text-lp-label-sm">
              <span className="text-lp-text-muted">SPRINT PROGRESS:</span>
              <span className="font-bold text-lp-accent-indigo">68% COMPLETE</span>
            </div>
          </div>

          <div className="flex items-center gap-space-md overflow-x-auto border-b border-lp-border-hairline bg-lp-surface px-space-md py-2 font-lp-body text-lp-body-sm">
            {TABS.map((tab) => (
              <span
                key={tab}
                className={
                  tab === "Code Workspace"
                    ? "cursor-pointer whitespace-nowrap border-b-2 border-lp-text-ink pb-1 font-semibold text-lp-text-ink"
                    : "cursor-pointer whitespace-nowrap text-lp-text-muted hover:text-lp-text-ink"
                }
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-12">
            <div className="flex flex-col justify-between border-r border-lp-border-hairline bg-lp-surface p-space-md font-lp-mono text-lp-label-sm lg:col-span-3">
              <div className="flex flex-col gap-1.5">
                <span className="mb-2 font-lp-mono text-lp-label-md uppercase tracking-wider text-lp-text-muted">
                  Workspace Tree
                </span>
                <div className="flex items-center gap-1.5 text-lp-text-muted">
                  <FolderOpen size={15} /> retail_pipeline/
                </div>
                <div className="ml-4 flex items-center gap-1.5 text-lp-text-muted">
                  <Folder size={15} /> migrations/
                </div>
                <div className="ml-4 flex items-center gap-1.5 rounded border border-lp-border-hairline bg-lp-surface-card p-1 font-medium text-lp-text-ink">
                  <Code2 size={15} className="text-lp-accent-ochre" /> sales_aggregations.sql
                </div>
                <div className="ml-4 flex items-center gap-1.5 text-lp-text-muted">
                  <FileText size={15} /> analysis_notebook.ipynb
                </div>
                <div className="ml-4 flex items-center gap-1.5 text-lp-text-muted">
                  <ListChecks size={15} /> test_window_specs.py
                </div>
              </div>
              <div className="border-t border-lp-border-hairline pt-space-md">
                <span className="block text-[10px] uppercase text-lp-text-muted">Live Contributors</span>
                <div className="mt-2 flex items-center gap-1.5">
                  {CONTRIBUTORS.map((c) => (
                    <span
                      key={c.initials}
                      className={`flex h-6 w-6 items-center justify-center rounded-full font-lp-mono text-[10px] text-lp-surface-card ${c.tone}`}
                    >
                      {c.initials}
                    </span>
                  ))}
                  <span className="ml-1 text-xs text-lp-text-muted">+1 online</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col bg-lp-surface-card p-space-md font-lp-mono text-lp-label-sm lg:col-span-6">
              <div className="flex items-center justify-between border-b border-lp-border-hairline pb-2 text-[11px] text-lp-text-muted">
                <span>sales_aggregations.sql — PostgreSQL 15 Engine</span>
                <span className="text-lp-accent-indigo">UTF-8 • LF</span>
              </div>
              <pre className="mt-3 overflow-x-auto leading-relaxed text-lp-text-ink">
                <SqlLine>
                  <span className={KW}>WITH</span> monthly_store_sales <span className={KW}>AS</span> (
                </SqlLine>
                <SqlLine>
                  {"    "}
                  <span className={KW}>SELECT</span>
                </SqlLine>
                <SqlLine>{"        store_id,"}</SqlLine>
                <SqlLine>
                  {"        DATE_TRUNC('month', transaction_date) "}
                  <span className={KW}>AS</span> sales_month,
                </SqlLine>
                <SqlLine>
                  {"        "}
                  <span className={FN}>SUM</span>(amount) <span className={KW}>AS</span> total_revenue
                </SqlLine>
                <SqlLine>
                  {"    "}
                  <span className={KW}>FROM</span> transactions
                </SqlLine>
                <SqlLine>
                  {"    "}
                  <span className={KW}>GROUP BY</span> 1, 2
                </SqlLine>
                <SqlLine>{")"}</SqlLine>
                <SqlLine>
                  <span className={KW}>SELECT</span>
                </SqlLine>
                <SqlLine>{"    store_id,"}</SqlLine>
                <SqlLine>{"    sales_month,"}</SqlLine>
                <SqlLine>{"    total_revenue,"}</SqlLine>
                <SqlLine>
                  {"    "}
                  <span className={FN}>AVG</span>(total_revenue) <span className={KW}>OVER</span> (
                </SqlLine>
                <SqlLine>
                  {"        "}
                  <span className={KW}>PARTITION BY</span> store_id
                </SqlLine>
                <SqlLine>
                  {"        "}
                  <span className={KW}>ORDER BY</span> sales_month
                </SqlLine>
                <SqlLine>
                  {"        "}
                  <span className={KW}>ROWS BETWEEN</span> 2 <span className={KW}>PRECEDING AND CURRENT ROW</span>
                </SqlLine>
                <SqlLine>
                  {"    ) "}
                  <span className={KW}>AS</span> rolling_3mo_avg,
                </SqlLine>
                <SqlLine>
                  {"    "}
                  <span className={FN}>DENSE_RANK</span>() <span className={KW}>OVER</span> (
                </SqlLine>
                <SqlLine>
                  {"        "}
                  <span className={KW}>PARTITION BY</span> sales_month
                </SqlLine>
                <SqlLine>
                  {"        "}
                  <span className={KW}>ORDER BY</span> total_revenue <span className={KW}>DESC</span>
                </SqlLine>
                <SqlLine>
                  {"    ) "}
                  <span className={KW}>AS</span> revenue_rank
                </SqlLine>
                <SqlLine>
                  <span className={KW}>FROM</span> monthly_store_sales;
                </SqlLine>
              </pre>
              <div className="mt-auto flex items-center justify-between border-t border-lp-border-hairline pt-2 text-[11px] text-lp-text-muted">
                <span>Line 24, Col 38</span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-lp-accent-indigo" /> Sandbox Connected (port 5432)
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between border-t border-lp-border-hairline bg-lp-surface p-space-md font-lp-mono text-lp-label-sm lg:col-span-3 lg:border-l lg:border-t-0">
              <div>
                <div className="flex items-center justify-between border-b border-lp-border-hairline pb-2">
                  <span className="text-[10px] font-bold uppercase text-lp-text-muted">Test Telemetry</span>
                  <span className="font-bold text-lp-accent-indigo">14 / 14 PASS</span>
                </div>
                <div className="mt-3 flex flex-col gap-2 text-xs">
                  {TESTS.map((t) => (
                    <div key={t} className="flex items-center gap-1.5 text-lp-text-ink">
                      <span className="text-lp-accent-indigo">✓</span>
                      <span>{t}</span>
                    </div>
                  ))}
                  <div className="mt-2 border-l border-lp-border-strong pl-3 text-[11px] text-lp-text-muted">
                    Query Execution: 18.4ms
                    <br />
                    Buffer Cache Hit: 99.4%
                    <br />
                    Test Coverage: 100.0%
                  </div>
                </div>
              </div>
              <div className="rounded border border-lp-border-hairline bg-lp-surface-card p-space-sm text-[11px]">
                <span className="mb-1 block font-bold text-lp-accent-ochre">PROVED CAPABILITY</span>
                <span>SQL Window Aggregates verified against production test dataset.</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
