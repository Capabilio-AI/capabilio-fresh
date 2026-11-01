"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Send } from "lucide-react";
import type { StatisticsContent } from "@/lib/arena-workstations/tools/statistics";
import { DataTable, DownloadCsv } from "./DataTable";
import { histogram, summarise } from "./stats-explore";
import { useDraft, type ToolProps } from "./useDraft";

/**
 * A statistics workbench in the shape analysts use for a first look at data (SPSS's Data View / Variable View, Excel's Data Analysis, a notebook's
 * describe + plots): the data, a variable table that shows size, gaps and range, and charts for shape and relationships. It deliberately stops short of
 * computing the statistics the questions ask for: choosing the method and doing it (in a spreadsheet or Python) is the skill being graded.
 */
const ST = {
  "--st-line": "#d4d8de",
  "--st-pane": "#f3f5f8",
  "--st-ink": "#1f2933",
  "--st-muted": "#5b6672",
  "--st-accent": "#2b6cb0",
} as React.CSSProperties;

type Tab = "data" | "variables" | "charts";
const select = "rounded-sm border border-[var(--st-line)] bg-white px-2 py-1 text-[12.5px] text-[var(--st-ink)] outline-none focus:border-[var(--st-accent)]";

export function StatisticsTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<StatisticsContent>) {
  const [answers, setAnswers] = useDraft<Record<string, string>>(attemptId, "answers", {});
  const [working, setWorking] = useDraft(attemptId, "working", "");
  const [tab, setTab] = useState<Tab>("data");
  const { dataset } = content;
  const numeric = dataset.columns.map((c, j) => ({ c, j })).filter((x) => x.c.type === "number");
  const [histCol, setHistCol] = useState(numeric[0]?.c.name ?? "");
  const [xCol, setXCol] = useState(numeric[0]?.c.name ?? "");
  const [yCol, setYCol] = useState(numeric[1]?.c.name ?? numeric[0]?.c.name ?? "");

  const fields = content.questions.flatMap((q) => q.fields);
  const complete = fields.every((f) => (answers[f.key] ?? "").trim() !== "");
  const colValues = (name: string) => {
    const j = dataset.columns.findIndex((c) => c.name === name);
    return j < 0 ? [] : dataset.rows.map((r) => r[j]);
  };
  const bins = histogram(colValues(histCol).filter((v): v is number => typeof v === "number"));
  const points = dataset.rows
    .map((r) => ({ x: r[dataset.columns.findIndex((c) => c.name === xCol)], y: r[dataset.columns.findIndex((c) => c.name === yCol)] }))
    .filter((p): p is { x: number; y: number } => typeof p.x === "number" && typeof p.y === "number");

  return (
    <div style={ST} className="flex flex-col overflow-hidden rounded-lg border border-[var(--st-line)] bg-white font-[system-ui,sans-serif] text-[var(--st-ink)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-line)] bg-[var(--st-pane)] px-3 py-1.5">
        <span className="text-[13px] font-semibold">{dataset.name}.csv</span>
        <span className="text-[11.5px] text-[var(--st-muted)]">
          {dataset.rows.length} cases · {dataset.columns.length} variables
        </span>
        <span className="ml-auto text-[12px]">
          <DownloadCsv name={dataset.name} columns={dataset.columns} rows={dataset.rows} />
        </span>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <div role="tablist" aria-label="Workbench views" className="flex gap-0.5 border-b border-[var(--st-line)] bg-[var(--st-pane)] px-2 pt-1">
            {([["data", "Data View"], ["variables", "Variable View"], ["charts", "Charts"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-t px-3.5 py-1 text-[12.5px] ${tab === id ? "border border-b-white border-[var(--st-line)] bg-white font-semibold text-[var(--st-accent)]" : "border border-transparent text-[var(--st-muted)] hover:bg-white/60"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-[360px] p-3">
            {tab === "data" && <DataTable columns={dataset.columns} rows={dataset.rows} maxHeight={400} />}

            {tab === "variables" && (
              <div className="overflow-auto rounded-sm border border-[var(--st-line)]">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-[var(--st-pane)] text-left text-[var(--st-muted)]">
                    <tr>
                      {["#", "Name", "Type", "Valid N", "Missing", "Min", "Max", "Description"].map((h) => (
                        <th key={h} className="whitespace-nowrap border-b border-r border-[var(--st-line)] px-2.5 py-1.5 font-semibold last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.columns.map((c, j) => {
                      const s = summarise(dataset.rows.map((r) => r[j]));
                      return (
                        <tr key={c.name} className="border-b border-[var(--st-line)] last:border-0">
                          <td className="border-r border-[var(--st-line)] px-2.5 py-1.5 text-[var(--st-muted)]">{j + 1}</td>
                          <td className="border-r border-[var(--st-line)] px-2.5 py-1.5 font-semibold">{c.name}</td>
                          <td className="border-r border-[var(--st-line)] px-2.5 py-1.5">{c.type === "number" ? "Scale" : c.type === "date" ? "Date" : "Nominal"}</td>
                          <td className="border-r border-[var(--st-line)] px-2.5 py-1.5 tabular-nums">{s.n}</td>
                          <td className="border-r border-[var(--st-line)] px-2.5 py-1.5 tabular-nums">{s.missing}</td>
                          <td className="border-r border-[var(--st-line)] px-2.5 py-1.5 tabular-nums">{s.min ?? "–"}</td>
                          <td className="border-r border-[var(--st-line)] px-2.5 py-1.5 tabular-nums">{s.max ?? "–"}</td>
                          <td className="px-2.5 py-1.5 text-[var(--st-muted)]">{c.description ?? ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="border-t border-[var(--st-line)] bg-[var(--st-pane)] px-2.5 py-1.5 text-[11.5px] text-[var(--st-muted)]">Size, gaps and range only. The statistics the report asks for are yours to compute: download the CSV and use a spreadsheet or Python.</p>
              </div>
            )}

            {tab === "charts" && (
              <div className="grid gap-4 xl:grid-cols-2">
                <figure className="rounded-sm border border-[var(--st-line)] p-3">
                  <figcaption className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
                    Histogram of
                    <select value={histCol} onChange={(e) => setHistCol(e.target.value)} aria-label="Histogram variable" className={select}>
                      {numeric.map(({ c }) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </figcaption>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bins} barCategoryGap={1} margin={{ top: 8, right: 8 }}>
                        <CartesianGrid vertical={false} stroke="#e4e7ec" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2b6cb0" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--st-muted)]">Look at the shape before you choose between mean and median.</p>
                </figure>
                <figure className="rounded-sm border border-[var(--st-line)] p-3">
                  <figcaption className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
                    Scatter
                    <select value={yCol} onChange={(e) => setYCol(e.target.value)} aria-label="Scatter y variable" className={select}>
                      {numeric.map(({ c }) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                    by
                    <select value={xCol} onChange={(e) => setXCol(e.target.value)} aria-label="Scatter x variable" className={select}>
                      {numeric.map(({ c }) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </figcaption>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 8 }}>
                        <CartesianGrid stroke="#e4e7ec" />
                        <XAxis type="number" dataKey="x" name={xCol} tick={{ fontSize: 11 }} tickLine={false} />
                        <YAxis type="number" dataKey="y" name={yCol} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                        <Scatter data={points} fill="#2b6cb0" fillOpacity={0.7} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--st-muted)]">A pattern here is what a correlation or a regression line summarises.</p>
                </figure>
              </div>
            )}
          </div>
        </div>

        <aside className="shrink-0 border-t border-[var(--st-line)] bg-[var(--st-pane)] lg:w-[360px] lg:border-l lg:border-t-0" aria-label="Report">
          <h3 className="border-b border-[var(--st-line)] px-3 py-2 text-[13px] font-semibold">Report</h3>
          <div className="flex flex-col gap-3 p-3">
            {content.questions.map((q, i) => (
              <div key={q.id} className="rounded-sm border border-[var(--st-line)] bg-white p-3">
                <p className="text-[13px] leading-relaxed">
                  <span className="mr-1.5 font-semibold text-[var(--st-accent)]">Q{i + 1}.</span>
                  {q.text.split("`").map((part, k) => (k % 2 ? <code key={k} className="rounded bg-[var(--st-pane)] px-1 font-lp-mono text-[12px]">{part}</code> : part))}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  {q.fields.map((f) => (
                    <label key={f.key} className="flex flex-col gap-1 text-[11.5px] font-semibold text-[var(--st-muted)]">
                      {f.label}
                      {f.kind === "choice" ? (
                        <select value={answers[f.key] ?? ""} disabled={closed} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} className={`${select} w-36 text-[13px]`}>
                          <option value="">Choose…</option>
                          {f.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input inputMode="decimal" value={answers[f.key] ?? ""} disabled={closed} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} placeholder={`${f.decimals} decimals`} className={`${select} w-36 font-lp-mono text-[13px] tabular-nums`} />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {!closed && (
              <>
                <label className="block text-[12px] font-semibold">
                  Your working <span className="font-normal text-[var(--st-muted)]">(optional: method, formulas, what it means for the requester)</span>
                  <textarea value={working} onChange={(e) => setWorking(e.target.value)} rows={4} maxLength={5000} className="mt-1.5 w-full resize-y rounded-sm border border-[var(--st-line)] bg-white px-2.5 py-2 font-lp-mono text-[12.5px] font-normal outline-none focus:border-[var(--st-accent)]" />
                </label>
                <button type="button" onClick={() => onSubmit({ answers, working: working.trim() || undefined })} disabled={submitting || !complete} className="flex items-center justify-center gap-1.5 rounded-sm bg-[var(--st-accent)] px-4 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-50">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Submit report
                </button>
                {!complete && <p className="text-[11.5px] text-[var(--st-muted)]">Answer every field to submit.</p>}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
