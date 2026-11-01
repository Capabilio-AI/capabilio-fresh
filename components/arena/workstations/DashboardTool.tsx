"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Calendar, ChartLine, ChartPie, Hash, LayoutDashboard, Loader2, Plus, Sigma, Table2, Type, X } from "lucide-react";
import { AGGREGATIONS, BI_OPERATORS, QUICK_MEASURES, SORTS, evaluateSpec, type BiSpec } from "@/lib/arena-workstations/engines/bi";
import type { DashboardContent } from "@/lib/arena-workstations/tools/dashboard";
import { DataTable } from "./DataTable";
import { useDraft, type ToolProps } from "./useDraft";

/**
 * A report canvas in the shape of Power BI Desktop: Report and Data views on the left, a page with one visual on a light canvas, and on the right the
 * Visualizations pane (chart types plus Axis / Values / Filters wells) above the Data pane (the table's fields). It builds the same structured spec as
 * before, so grading is unchanged. It is a Power BI-style builder, not Power BI: there is no DAX and no data model, and the interface says so.
 */
const PBI = {
  "--pbi-canvas": "#e9e8e6",
  "--pbi-pane": "#f5f4f2",
  "--pbi-line": "#d6d4d1",
  "--pbi-ink": "#252423",
  "--pbi-muted": "#605e5c",
  "--pbi-yellow": "#f2c811",
  "--pbi-blue": "#118dff",
} as React.CSSProperties;

const PALETTE = ["#118dff", "#12239e", "#e66c37", "#6b007b", "#e044a7", "#744ec2", "#d9b300", "#d64550"];
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { dimension_asc: "Axis, A → Z", measure_desc: "Value, high → low", measure_asc: "Value, low → high" };
const AGG_LABEL: Record<(typeof AGGREGATIONS)[number], string> = { sum: "Sum", avg: "Average", count: "Count", min: "Minimum", max: "Maximum" };
const DAX_STARTER = "SUM([revenue])";
const QUICK_LABEL: Record<(typeof QUICK_MEASURES)[number], string> = { none: "None", percent_of_total: "Percent of total", running_total: "Running total", ratio: "Ratio (A ÷ B)" };
const VISUALS = [
  { type: "bar", label: "Clustered column chart", icon: BarChart3 },
  { type: "line", label: "Line chart", icon: ChartLine },
  { type: "pie", label: "Pie chart", icon: ChartPie },
  { type: "table", label: "Table", icon: Table2 },
] as const;
const field = "min-w-0 rounded-sm border border-[var(--pbi-line)] bg-white px-1.5 py-1 text-[12px] text-[var(--pbi-ink)] outline-none focus:border-[var(--pbi-blue)]";

type View = "report" | "data";

export function DashboardTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<DashboardContent>) {
  const { dataset } = content;
  const numeric = dataset.columns.filter((c) => c.type === "number").map((c) => c.name);
  const initial: BiSpec = { chart_type: "bar", dimension: dataset.columns[0].name, dimension_grain: "value", measure: numeric[0] ?? null, aggregation: numeric.length ? "sum" : "count", quick: "none", measure2: null, dax: null, filters: [], sort: "dimension_asc", limit: null };
  const [spec, setSpec] = useDraft<BiSpec>(attemptId, "spec", initial);
  const [view, setView] = useState<View>("report");
  const update = (patch: Partial<BiSpec>) => setSpec({ ...spec, ...patch });
  const dimIsDate = dataset.columns.find((c) => c.name === spec.dimension)?.type === "date";

  const series = useMemo(() => {
    try {
      return { points: evaluateSpec(dataset, spec), error: null };
    } catch (e) {
      return { points: [], error: (e as Error).message };
    }
  }, [dataset, spec]);

  const base = spec.aggregation === "count" || !spec.measure ? "Count of rows" : `${AGG_LABEL[spec.aggregation]} of ${spec.measure}`;
  const valueName = spec.dax !== null ? "Measure" : spec.quick === "percent_of_total" ? `${base} as % of total` : spec.quick === "running_total" ? `Running total of ${base.toLowerCase()}` : spec.quick === "ratio" && spec.measure2 ? `${spec.measure} ÷ ${spec.measure2}` : base;
  const visualTitle = `${valueName} by ${spec.dimension}`;

  /** Choosing a quick measure keeps the rest of the spec valid: shares and running totals need a sum, a ratio needs a sum and a second numeric field. */
  function setQuick(choice: BiSpec["quick"] | "dax") {
    if (closed) return;
    if (choice === "dax") return update({ dax: spec.dax ?? DAX_STARTER, quick: "none", measure2: null });
    const quick = choice;
    if (spec.dax !== null) setSpec({ ...spec, dax: null });
    const second = numeric.find((n) => n !== spec.measure) ?? null;
    if (quick === "ratio") update({ quick, aggregation: "sum", measure: spec.measure ?? numeric[0] ?? null, measure2: spec.measure2 ?? second });
    else if (quick === "none") update({ quick, measure2: null });
    else update({ quick, measure2: null, aggregation: spec.aggregation === "avg" || spec.aggregation === "min" || spec.aggregation === "max" ? "sum" : spec.aggregation });
  }

  /** Ticking a field in the Data pane puts it where Power BI would: a number goes to Values, anything else to Axis. */
  function pick(name: string, type: string) {
    if (closed) return;
    if (type === "number") update({ measure: name, aggregation: spec.aggregation === "count" ? "sum" : spec.aggregation });
    else update({ dimension: name, dimension_grain: "value" });
  }

  return (
    <div style={PBI} className="flex flex-col overflow-hidden rounded-lg border border-[var(--pbi-line)] bg-white font-[Segoe_UI,system-ui,sans-serif] text-[var(--pbi-ink)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3 border-b border-[var(--pbi-line)] bg-[var(--pbi-pane)] px-3 py-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-[var(--pbi-yellow)]" aria-hidden>
          <BarChart3 size={13} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 truncate text-[13px] font-semibold">{dataset.name} report</span>
        <span className="hidden text-[11.5px] text-[var(--pbi-muted)] sm:inline">Power BI-style builder · one visual per page</span>
        {!closed && (
          <button type="button" onClick={() => onSubmit({ spec })} disabled={submitting || Boolean(series.error)} className="ml-auto flex items-center gap-1.5 rounded-sm bg-[var(--pbi-yellow)] px-3.5 py-1 text-[12.5px] font-semibold hover:brightness-95 disabled:opacity-50">
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Publish
          </button>
        )}
      </div>

      <div className="flex min-h-[520px] flex-col lg:flex-row">
        <nav aria-label="Views" className="flex shrink-0 gap-1 border-b border-[var(--pbi-line)] bg-[var(--pbi-pane)] p-1.5 lg:w-[52px] lg:flex-col lg:border-b-0 lg:border-r">
          {([["report", "Report view", LayoutDashboard], ["data", "Data view", Table2]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} title={label} className={`flex flex-1 flex-col items-center gap-0.5 rounded-sm px-1 py-1.5 text-[10px] lg:flex-none ${view === id ? "bg-white font-semibold shadow-[inset_3px_0_0_var(--pbi-yellow)]" : "text-[var(--pbi-muted)] hover:bg-white/70"}`}>
              <Icon size={18} />
              {id === "report" ? "Report" : "Data"}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col bg-[var(--pbi-canvas)]">
          {view === "report" ? (
            <div className="flex flex-1 items-start justify-center overflow-auto p-4">
              <div className="w-full max-w-[760px] rounded-sm bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.18)]">
                <h3 className="text-[14px] font-semibold">{visualTitle}</h3>
                <div className="mt-2 h-[340px]">
                  {series.error ? (
                    <p className="text-[12.5px] text-[#a4262c]">{series.error}</p>
                  ) : series.points.length === 0 ? (
                    <p className="text-[12.5px] text-[var(--pbi-muted)]">No data matches the filters on this visual.</p>
                  ) : spec.chart_type === "table" ? (
                    <DataTable columns={[{ name: spec.dimension, type: "text" }, { name: valueName, type: "number" }]} rows={series.points.map((p) => [p.label, p.value])} maxHeight={340} />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {spec.chart_type === "pie" ? (
                        <PieChart>
                          <Pie data={series.points} dataKey="value" nameKey="label" outerRadius={120} label>
                            {series.points.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      ) : spec.chart_type === "line" ? (
                        <LineChart data={series.points} margin={{ top: 16, right: 12 }}>
                          <CartesianGrid vertical={false} stroke="#e1dfdd" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#605e5c" }} tickLine={false} axisLine={{ stroke: "#c8c6c4" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#605e5c" }} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Line dataKey="value" stroke={PALETTE[0]} strokeWidth={2.5} dot={{ r: 3.5, fill: PALETTE[0] }} />
                        </LineChart>
                      ) : (
                        <BarChart data={series.points} margin={{ top: 16, right: 12 }}>
                          <CartesianGrid vertical={false} stroke="#e1dfdd" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#605e5c" }} tickLine={false} axisLine={{ stroke: "#c8c6c4" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#605e5c" }} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Bar dataKey="value" fill={PALETTE[0]}>
                            {series.points.length <= 12 && <LabelList dataKey="value" position="top" style={{ fontSize: 10.5, fill: "#252423" }} formatter={(v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : String(v ?? ""))} />}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-white p-3">
              <DataTable columns={dataset.columns} rows={dataset.rows} maxHeight={460} caption={`${dataset.name} · ${dataset.rows.length} rows`} />
            </div>
          )}
          <div className="flex items-center gap-1 border-t border-[var(--pbi-line)] bg-[var(--pbi-pane)] px-2 text-[12px]">
            <span className="border-t-2 border-[var(--pbi-yellow)] bg-white px-4 py-1.5 font-semibold">Page 1</span>
            <span className="ml-auto text-[11px] text-[var(--pbi-muted)]">{series.points.length} data points</span>
          </div>
        </div>

        <aside className="flex shrink-0 flex-col border-t border-[var(--pbi-line)] bg-[var(--pbi-pane)] lg:w-[290px] lg:border-l lg:border-t-0" aria-label="Visualizations and data">
          <Pane title="Visualizations">
            <div className="flex gap-1" role="group" aria-label="Visual type">
              {VISUALS.map(({ type, label, icon: Icon }) => (
                <button key={type} type="button" disabled={closed} aria-pressed={spec.chart_type === type} title={label} onClick={() => update({ chart_type: type })} className={`flex h-8 w-9 items-center justify-center rounded-sm border ${spec.chart_type === type ? "border-[var(--pbi-yellow)] bg-white shadow-[inset_0_-2px_0_var(--pbi-yellow)]" : "border-transparent hover:bg-white"}`}>
                  <Icon size={17} />
                </button>
              ))}
            </div>

            <Well label={spec.chart_type === "pie" ? "Legend" : "X-axis"}>
              <div className="flex items-center gap-1">
                <select value={spec.dimension} disabled={closed} onChange={(e) => update({ dimension: e.target.value, dimension_grain: "value" })} aria-label="Axis field" className={`${field} flex-1`}>
                  {dataset.columns.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
                {dimIsDate && (
                  <select value={spec.dimension_grain} disabled={closed} onChange={(e) => update({ dimension_grain: e.target.value as BiSpec["dimension_grain"] })} aria-label="Date hierarchy" className={field}>
                    <option value="value">Date</option>
                    <option value="month">Month</option>
                  </select>
                )}
              </div>
            </Well>

            <Well label="Y-axis (values)">
              <div className="flex items-center gap-1">
                <select value={spec.aggregation} disabled={closed || spec.dax !== null} onChange={(e) => update({ aggregation: e.target.value as BiSpec["aggregation"], measure: e.target.value === "count" ? null : spec.measure ?? numeric[0] ?? null })} aria-label="Summarisation" className={field}>
                  {AGGREGATIONS.map((a) => (
                    <option key={a} value={a}>
                      {AGG_LABEL[a]}
                    </option>
                  ))}
                </select>
                <select value={spec.measure ?? ""} disabled={closed || spec.dax !== null || spec.aggregation === "count"} onChange={(e) => update({ measure: e.target.value || null })} aria-label="Value field" className={`${field} flex-1`}>
                  {spec.aggregation === "count" && <option value="">of rows</option>}
                  {numeric.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            </Well>

            <Well label="Quick measure">
              <div className="flex items-center gap-1">
                <select value={spec.dax !== null ? "dax" : spec.quick} disabled={closed} onChange={(e) => setQuick(e.target.value as BiSpec["quick"] | "dax")} aria-label="Quick measure" className={`${field} flex-1`}>
                  {QUICK_MEASURES.map((q) => (
                    <option key={q} value={q}>
                      {QUICK_LABEL[q]}
                    </option>
                  ))}
                  <option value="dax">New measure (DAX)</option>
                </select>
                {spec.quick === "ratio" && spec.dax === null && (
                  <>
                    <span className="text-[12px] text-[var(--pbi-muted)]" aria-hidden>
                      ÷
                    </span>
                    <select value={spec.measure2 ?? ""} disabled={closed} onChange={(e) => update({ measure2: e.target.value || null })} aria-label="Divide by" className={`${field} flex-1`}>
                      {numeric.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              {spec.dax !== null && (
                <div className="mt-1.5">
                  <textarea value={spec.dax} disabled={closed} onChange={(e) => update({ dax: e.target.value })} rows={4} spellCheck={false} aria-label="DAX formula" placeholder={'Measure = DIVIDE(SUM([revenue]), COUNTROWS())'} className={`${field} w-full resize-y font-lp-mono text-[12px] leading-snug [font-variant-ligatures:none]`} />
                  <p className="mt-1 text-[11px] leading-snug text-[var(--pbi-muted)]">SUM AVERAGE MIN MAX COUNT COUNTROWS DISTINCTCOUNT DIVIDE CALCULATE ALL IF ROUND ABS SUMX AVERAGEX. Columns are written [like_this]. Each bar is its own filter context; CALCULATE changes it.</p>
                </div>
              )}
            </Well>

            <Well label="Filters on this visual">
              <div className="flex flex-col gap-1.5">
                {spec.filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <select value={f.column} disabled={closed} aria-label="Filter field" onChange={(e) => update({ filters: spec.filters.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)) })} className={`${field} flex-1`}>
                      {dataset.columns.map((c) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <select value={f.operator} disabled={closed} aria-label="Condition" onChange={(e) => update({ filters: spec.filters.map((x, j) => (j === i ? { ...x, operator: e.target.value as typeof f.operator } : x)) })} className={`${field} w-[52px]`}>
                      {BI_OPERATORS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <input
                      value={String(f.value)}
                      disabled={closed}
                      aria-label="Filter value"
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const isNum = dataset.columns.find((c) => c.name === f.column)?.type === "number";
                        update({ filters: spec.filters.map((x, j) => (j === i ? { ...x, value: isNum && e.target.value.trim() !== "" && Number.isFinite(n) ? n : e.target.value } : x)) });
                      }}
                      className={`${field} w-[64px]`}
                    />
                    {!closed && (
                      <button type="button" aria-label="Remove filter" onClick={() => update({ filters: spec.filters.filter((_, j) => j !== i) })} className="text-[var(--pbi-muted)] hover:text-[#a4262c]">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {!closed && spec.filters.length < 3 && (
                  <button type="button" onClick={() => update({ filters: [...spec.filters, { column: dataset.columns[0].name, operator: "=", value: "" }] })} className="flex w-fit items-center gap-1 text-[12px] font-semibold text-[#0b6bcb]">
                    <Plus size={12} />
                    Add data field here
                  </button>
                )}
              </div>
            </Well>

            <Well label="Sort and Top N">
              <div className="flex items-center gap-1">
                <select value={spec.sort} disabled={closed} onChange={(e) => update({ sort: e.target.value as BiSpec["sort"] })} aria-label="Sort by" className={`${field} flex-1`}>
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {SORT_LABEL[s]}
                    </option>
                  ))}
                </select>
                <input type="number" min={1} max={20} value={spec.limit ?? ""} disabled={closed} onChange={(e) => update({ limit: e.target.value ? Math.max(1, Math.min(20, Number(e.target.value))) : null })} placeholder="Top N" aria-label="Top N" className={`${field} w-[58px]`} />
              </div>
            </Well>
          </Pane>

          <Pane title="Data" grow>
            <p className="flex items-center gap-1.5 px-0.5 text-[12px] font-semibold">
              <Table2 size={13} className="text-[#0b6bcb]" />
              {dataset.name}
            </p>
            <ul className="mt-0.5 flex flex-col">
              {dataset.columns.map((c) => {
                const on = c.name === spec.dimension || c.name === spec.measure;
                return (
                  <li key={c.name}>
                    <button type="button" disabled={closed} onClick={() => pick(c.name, c.type)} title={c.description ?? c.name} className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-[12.5px] hover:bg-white disabled:hover:bg-transparent">
                      <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border ${on ? "border-[var(--pbi-yellow)] bg-[var(--pbi-yellow)]" : "border-[#a19f9d] bg-white"}`} aria-hidden>
                        {on && <span className="text-[9px] font-bold leading-none">✓</span>}
                      </span>
                      {c.type === "number" ? <Sigma size={12} className="shrink-0 text-[var(--pbi-muted)]" /> : c.type === "date" ? <Calendar size={12} className="shrink-0 text-[var(--pbi-muted)]" /> : <Type size={12} className="shrink-0 text-[var(--pbi-muted)]" />}
                      <span className="truncate">{c.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Pane>
        </aside>
      </div>
    </div>
  );
}

function Pane({ title, grow, children }: { title: string; grow?: boolean; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-2 border-b border-[var(--pbi-line)] px-3 py-2.5 last:border-b-0 ${grow ? "flex-1" : ""}`}>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Well({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] text-[var(--pbi-muted)]">{label}</span>
      <div className="rounded-sm border border-dashed border-[#a19f9d] bg-white/60 p-1.5">{children}</div>
    </div>
  );
}
