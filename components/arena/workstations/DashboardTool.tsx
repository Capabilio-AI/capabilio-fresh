"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Plus, Send, X } from "lucide-react";
import { AGGREGATIONS, BI_OPERATORS, CHART_TYPES, SORTS, evaluateSpec, type BiSpec } from "@/lib/arena-workstations/engines/bi";
import type { DashboardContent } from "@/lib/arena-workstations/tools/dashboard";
import { DataTable } from "./DataTable";
import { useDraft, type ToolProps } from "./useDraft";

const PALETTE = ["#3457a6", "#ff5701", "#1a7d4d", "#7c3aed", "#b25e09", "#c2410c"];
const inputClass = "w-full rounded-lg border border-app-border bg-white px-2.5 py-1.5 font-lp-body text-[12.5px] text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15";
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { dimension_asc: "By category / date", measure_desc: "Value, high → low", measure_asc: "Value, low → high" };

export function DashboardTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<DashboardContent>) {
  const { dataset } = content;
  const numeric = dataset.columns.filter((c) => c.type === "number").map((c) => c.name);
  const initial: BiSpec = { chart_type: "bar", dimension: dataset.columns[0].name, dimension_grain: "value", measure: numeric[0] ?? null, aggregation: numeric.length ? "sum" : "count", filters: [], sort: "dimension_asc", limit: null };
  const [spec, setSpec] = useDraft<BiSpec>(attemptId, "spec", initial);
  const update = (patch: Partial<BiSpec>) => setSpec({ ...spec, ...patch });
  const dimIsDate = dataset.columns.find((c) => c.name === spec.dimension)?.type === "date";

  const series = useMemo(() => {
    try {
      return { points: evaluateSpec(dataset, spec), error: null };
    } catch (e) {
      return { points: [], error: (e as Error).message };
    }
  }, [dataset, spec]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-3 rounded-xl border border-app-border bg-white p-4 lg:w-[280px]">
        <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Visual builder</h3>
        <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
          Chart type
          <div className="grid grid-cols-4 gap-1">
            {CHART_TYPES.map((t) => (
              <button key={t} type="button" disabled={closed} aria-pressed={spec.chart_type === t} onClick={() => update({ chart_type: t })} className={`rounded-md px-2 py-1.5 font-lp-body text-[12px] capitalize ${spec.chart_type === t ? "bg-app-charcoal text-white" : "border border-app-border text-app-charcoal"}`}>
                {t}
              </button>
            ))}
          </div>
        </label>
        <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
          Axis / category
          <select value={spec.dimension} disabled={closed} onChange={(e) => update({ dimension: e.target.value, dimension_grain: "value" })} className={inputClass}>
            {dataset.columns.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        {dimIsDate && (
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Date grouping
            <select value={spec.dimension_grain} disabled={closed} onChange={(e) => update({ dimension_grain: e.target.value as BiSpec["dimension_grain"] })} className={inputClass}>
              <option value="value">Each date</option>
              <option value="month">By month</option>
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Aggregation
            <select value={spec.aggregation} disabled={closed} onChange={(e) => update({ aggregation: e.target.value as BiSpec["aggregation"], measure: e.target.value === "count" ? null : spec.measure ?? numeric[0] ?? null })} className={inputClass}>
              {AGGREGATIONS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Measure
            <select value={spec.measure ?? ""} disabled={closed || spec.aggregation === "count"} onChange={(e) => update({ measure: e.target.value || null })} className={inputClass}>
              {spec.aggregation === "count" && <option value="">(rows)</option>}
              {numeric.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-lp-mono text-[10.5px] text-app-muted">Filters</span>
          {spec.filters.map((f, i) => (
            <div key={i} className="flex items-center gap-1">
              <select value={f.column} disabled={closed} onChange={(e) => update({ filters: spec.filters.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)) })} className={inputClass}>
                {dataset.columns.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
              <select value={f.operator} disabled={closed} onChange={(e) => update({ filters: spec.filters.map((x, j) => (j === i ? { ...x, operator: e.target.value as typeof f.operator } : x)) })} className={`${inputClass} w-16`}>
                {BI_OPERATORS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <input
                value={String(f.value)}
                disabled={closed}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const isNum = dataset.columns.find((c) => c.name === f.column)?.type === "number";
                  update({ filters: spec.filters.map((x, j) => (j === i ? { ...x, value: isNum && e.target.value.trim() !== "" && Number.isFinite(n) ? n : e.target.value } : x)) });
                }}
                className={inputClass}
              />
              {!closed && (
                <button type="button" aria-label="Remove filter" onClick={() => update({ filters: spec.filters.filter((_, j) => j !== i) })} className="text-app-rose">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          {!closed && spec.filters.length < 3 && (
            <button type="button" onClick={() => update({ filters: [...spec.filters, { column: dataset.columns[0].name, operator: "=", value: "" }] })} className="flex w-fit items-center gap-1 font-lp-mono text-[11px] font-semibold text-app-blue">
              <Plus size={12} />
              Add filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Sort
            <select value={spec.sort} disabled={closed} onChange={(e) => update({ sort: e.target.value as BiSpec["sort"] })} className={inputClass}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Top N
            <input type="number" min={1} max={20} value={spec.limit ?? ""} disabled={closed} onChange={(e) => update({ limit: e.target.value ? Math.max(1, Math.min(20, Number(e.target.value))) : null })} placeholder="All" className={inputClass} />
          </label>
        </div>
        {!closed && (
          <button type="button" onClick={() => onSubmit({ spec })} disabled={submitting || Boolean(series.error)} className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Publish chart
          </button>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <section className="rounded-xl border border-app-border bg-white p-4">
          <h3 className="mb-2 font-lp-body text-[12px] font-semibold text-app-charcoal">Preview</h3>
          {series.error ? (
            <p className="font-lp-body text-[12.5px] text-app-rose">{series.error}</p>
          ) : series.points.length === 0 ? (
            <p className="font-lp-body text-[12.5px] text-app-muted">No data matches — check your filters.</p>
          ) : (
            <div className="h-[300px]">
              {spec.chart_type === "table" ? (
                <DataTable columns={[{ name: spec.dimension, type: "text" }, { name: spec.measure ?? "count", type: "number" }]} rows={series.points.map((p) => [p.label, p.value])} maxHeight={300} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {spec.chart_type === "pie" ? (
                    <PieChart>
                      <Pie data={series.points} dataKey="value" nameKey="label" outerRadius={110} label>
                        {series.points.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  ) : spec.chart_type === "line" ? (
                    <LineChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line dataKey="value" stroke="#3457a6" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  ) : (
                    <BarChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3457a6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          )}
        </section>
        <DataTable columns={dataset.columns} rows={dataset.rows} maxHeight={260} caption={`${dataset.name} · ${dataset.rows.length} rows`} />
      </div>
    </div>
  );
}
