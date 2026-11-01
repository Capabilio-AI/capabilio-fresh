import { z } from "zod";
import { type Cell, type Dataset } from "./dataset";
import { evaluateMeasure, type ContextFilter } from "./dax";

// A constrained BI builder: the candidate's chart is a structured spec. Both
// the expected and the candidate spec are evaluated on the same dataset and
// the resulting series are compared, so equivalent specs pass; the chart type
// must be one that suits the data (server rule, not the AI's say-so).

export const CHART_TYPES = ["bar", "line", "pie", "table"] as const;
export const AGGREGATIONS = ["sum", "avg", "count", "min", "max"] as const;
export const BI_OPERATORS = ["=", "!=", ">", ">=", "<", "<="] as const;
export const SORTS = ["dimension_asc", "measure_desc", "measure_asc"] as const;
/** Quick measures, as in Power BI's own menu: show each group as a percent of the total, as a running total along the axis, or as one field divided by another. */
export const QUICK_MEASURES = ["none", "percent_of_total", "running_total", "ratio"] as const;

export const BiFilterSchema = z.object({ column: z.string(), operator: z.enum(BI_OPERATORS), value: z.union([z.number(), z.string().max(80)]) });
export const BiSpecSchema = z.object({
  chart_type: z.enum(CHART_TYPES),
  dimension: z.string(),
  dimension_grain: z.enum(["value", "month"]).default("value"),
  measure: z.string().nullable(),
  aggregation: z.enum(AGGREGATIONS),
  quick: z.enum(QUICK_MEASURES).default("none"),
  /** the denominator field of a ratio (the measure is the numerator) */
  measure2: z.string().nullable().default(null),
  /** a DAX measure; when present it supplies each bar's value and the aggregation / quick measure are ignored */
  dax: z.string().max(400).nullable().default(null),
  filters: z.array(BiFilterSchema).max(3).default([]),
  sort: z.enum(SORTS).default("dimension_asc"),
  limit: z.number().int().min(1).max(20).nullable().default(null),
});
export type BiSpec = z.infer<typeof BiSpecSchema>;
export interface SeriesPoint {
  label: string;
  value: number;
}

function matches(v: Cell, op: (typeof BI_OPERATORS)[number], target: number | string): boolean {
  if (v === null) return false;
  if (typeof target === "number" && typeof v === "number") {
    switch (op) {
      case "=": return v === target;
      case "!=": return v !== target;
      case ">": return v > target;
      case ">=": return v >= target;
      case "<": return v < target;
      case "<=": return v <= target;
    }
  }
  const a = String(v).toLowerCase();
  const b = String(target).toLowerCase();
  switch (op) {
    case "=": return a === b;
    case "!=": return a !== b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
  }
}


/** Each axis value is a filter context (its own rows, plus the visual's filters); the DAX measure is worked out once per axis value and blanks are left off the chart. */
function daxSeries(ds: Dataset, spec: BiSpec, dim: number, visual: ContextFilter[]): SeriesPoint[] {
  const labelOf = (row: readonly Cell[]) => (row[dim] === null ? null : spec.dimension_grain === "month" ? String(row[dim]).slice(0, 7) : String(row[dim]));
  const labels = [...new Set(ds.rows.filter((r) => visual.every((f) => f.test(r))).map(labelOf).filter((l): l is string => l !== null))].sort((a, b) => a.localeCompare(b));
  const dimName = ds.columns[dim].name.toLowerCase();
  const series: SeriesPoint[] = [];
  for (const label of labels) {
    const axis: ContextFilter = { columns: new Set([dimName]), test: (row) => labelOf(row) === label };
    const v = evaluateMeasure(ds, spec.dax!, [axis, ...visual]);
    if (v !== null) series.push({ label, value: Math.round(v * 100) / 100 });
  }
  return sortAndLimit(series, spec);
}

function sortAndLimit(series: SeriesPoint[], spec: BiSpec): SeriesPoint[] {
  const sorted =
    spec.sort === "measure_desc" ? [...series].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    : spec.sort === "measure_asc" ? [...series].sort((a, b) => a.value - b.value || a.label.localeCompare(b.label))
    : [...series].sort((a, b) => a.label.localeCompare(b.label));
  return spec.limit ? sorted.slice(0, spec.limit) : sorted;
}

/** Pure. Evaluates a spec to the series the chart plots; throws on invalid columns/types. */
export function evaluateSpec(ds: Dataset, spec: BiSpec): SeriesPoint[] {
  const idx = (name: string) => {
    const i = ds.columns.findIndex((c) => c.name === name);
    if (i === -1) throw new Error(`Unknown column ${name}`);
    return i;
  };
  const dim = idx(spec.dimension);
  if (spec.dimension_grain === "month" && ds.columns[dim].type !== "date") throw new Error("Monthly grouping needs a date column");
  const meas = spec.measure === null ? -1 : idx(spec.measure);
  if (spec.dax === null && spec.aggregation !== "count" && (meas === -1 || ds.columns[meas].type !== "number")) throw new Error("This aggregation needs a numeric measure");
  const den = spec.measure2 === null ? -1 : idx(spec.measure2);
  if (spec.dax !== null) {
    // the measure is written in DAX, so the pickers do not apply
  } else if (spec.quick === "ratio") {
    if (spec.aggregation !== "sum" || den === -1 || ds.columns[den].type !== "number") throw new Error("A ratio needs the total of one numeric field divided by the total of another");
  } else if ((spec.quick === "percent_of_total" || spec.quick === "running_total") && spec.aggregation !== "sum" && spec.aggregation !== "count") {
    throw new Error("Percent of total and running total only make sense for a total or a count");
  }
  const filters = spec.filters.map((f) => ({ i: idx(f.column), f }));

  if (spec.dax !== null) return daxSeries(ds, spec, dim, filters.map(({ i, f }) => ({ columns: new Set([ds.columns[i].name.toLowerCase()]), test: (row: readonly Cell[]) => matches(row[i], f.operator, f.value) })));

  const groups = new Map<string, { vals: number[]; den: number }>();
  for (const row of ds.rows) {
    if (!filters.every(({ i, f }) => matches(row[i], f.operator, f.value))) continue;
    const raw = row[dim];
    if (raw === null) continue;
    const label = spec.dimension_grain === "month" ? String(raw).slice(0, 7) : String(raw);
    const bucket = groups.get(label) ?? { vals: [], den: 0 };
    if (spec.aggregation === "count") bucket.vals.push(1);
    else if (typeof row[meas] === "number") bucket.vals.push(row[meas] as number);
    if (den !== -1 && typeof row[den] === "number") bucket.den += row[den] as number;
    groups.set(label, bucket);
  }

  let series: SeriesPoint[] = [...groups.entries()]
    .filter(([, g]) => g.vals.length > 0)
    .map(([label, g]) => {
      const vals = g.vals;
      const value =
        spec.aggregation === "count" ? vals.length
        : spec.aggregation === "sum" ? vals.reduce((s, x) => s + x, 0)
        : spec.aggregation === "avg" ? vals.reduce((s, x) => s + x, 0) / vals.length
        : spec.aggregation === "min" ? Math.min(...vals)
        : Math.max(...vals);
      return { label, value: spec.quick === "ratio" ? (g.den === 0 ? NaN : value / g.den) : value };
    })
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (spec.quick === "percent_of_total") {
    const total = series.reduce((s, p) => s + p.value, 0);
    series = total === 0 ? [] : series.map((p) => ({ label: p.label, value: (p.value / total) * 100 }));
  } else if (spec.quick === "running_total") {
    let running = 0;
    series = series.map((p) => ({ label: p.label, value: (running += p.value) }));
  }
  series = series.map((p) => ({ label: p.label, value: Math.round(p.value * 100) / 100 }));

  return sortAndLimit(series, spec);
}

/** Pure. Which chart types honestly fit a series: time → line/bar, few categories → bar/pie, many → bar/table. */
export function suitableChartTypes(ds: Dataset, spec: BiSpec, points: number): (typeof CHART_TYPES)[number][] {
  const dimType = ds.columns.find((c) => c.name === spec.dimension)?.type;
  if (spec.dimension_grain === "month" || dimType === "date") return ["line", "bar"];
  // a pie is parts of one whole: it fits sums and shares, not averages or ratios
  if (points <= 6 && spec.aggregation !== "avg" && spec.quick !== "ratio" && spec.quick !== "running_total") return ["bar", "pie"];
  return ["bar", "table"];
}

export interface BiGrade {
  passed: boolean;
  message: string;
  checks: { label: string; passed: boolean }[];
}

/** Pure. Compares the candidate's evaluated series with the expected one; values never leave the server. */
export function gradeDashboard(ds: Dataset, expected: BiSpec, candidate: BiSpec): BiGrade {
  const want = evaluateSpec(ds, expected);
  let got: SeriesPoint[];
  try {
    got = evaluateSpec(ds, candidate);
  } catch (e) {
    return { passed: false, message: `Your chart can't be built: ${(e as Error).message}.`, checks: [] };
  }

  const orderMatters = expected.sort !== "dimension_asc" || expected.limit !== null;
  const sameLabels =
    got.length === want.length &&
    (orderMatters ? want.every((p, i) => got[i].label.toLowerCase() === p.label.toLowerCase()) : want.every((p) => got.some((g) => g.label.toLowerCase() === p.label.toLowerCase())));
  const sameValues =
    sameLabels &&
    want.every((p) => {
      const g = got.find((x) => x.label.toLowerCase() === p.label.toLowerCase())!;
      return Math.abs(g.value - p.value) <= Math.max(0.01, Math.abs(p.value) * 0.001);
    });
  const chartOk = suitableChartTypes(ds, expected, want.length).includes(candidate.chart_type);

  const needsDax = expected.dax !== null;
  const checks = [
    ...(needsDax ? [{ label: "The value comes from a DAX measure you wrote", passed: candidate.dax !== null && candidate.dax.trim() !== "" }] : []),
    { label: `Categories${orderMatters ? " and order" : ""} match the request`, passed: sameLabels },
    { label: "Values match (measure, aggregation and filters)", passed: sameValues },
    { label: "Chart type suits this data", passed: chartOk },
  ];
  const passed = checks.every((c) => c.passed);
  return { passed, message: passed ? "Your dashboard answers the request." : "Not quite — see which checks failed.", checks };
}

const AGG_LABEL: Record<(typeof AGGREGATIONS)[number], string> = { sum: "total", avg: "average", count: "number of rows", min: "minimum", max: "maximum" };

/** Pure. Requirement bullets rendered from the expected spec (chart type deliberately omitted — choosing it is part of the task). */
export function describeSpec(spec: BiSpec): string[] {
  if (spec.dax !== null) {
    const lines = [`Write a DAX measure that gives the value described in the request, and chart it per \`${spec.dimension}\`${spec.dimension_grain === "month" ? " (by month)" : ""}.`];
    for (const f of spec.filters) lines.push(`Only include rows where \`${f.column}\` ${f.operator} ${typeof f.value === "number" ? f.value : `"${f.value}"`}.`);
    if (spec.limit) lines.push(`Show only the top ${spec.limit} by value.`);
    else if (spec.sort === "measure_desc") lines.push("Order from highest to lowest value.");
    else if (spec.sort === "measure_asc") lines.push("Order from lowest to highest value.");
    lines.push("Pick the chart type that best fits this data.");
    return lines;
  }
  const lines = [
    spec.aggregation === "count" ? `Show the number of records per \`${spec.dimension}\`${spec.dimension_grain === "month" ? " (by month)" : ""}.` : `Show the ${AGG_LABEL[spec.aggregation]} of \`${spec.measure}\` per \`${spec.dimension}\`${spec.dimension_grain === "month" ? " (by month)" : ""}.`,
  ];
  if (spec.quick === "percent_of_total") lines.push("Show each one as its percent of the overall total (the values add up to 100), not as an amount.");
  else if (spec.quick === "running_total") lines.push("Show the running total: each point adds to everything before it.");
  else if (spec.quick === "ratio" && spec.measure2) lines.push(`Show \`${spec.measure}\` divided by \`${spec.measure2}\` for each one (the total of one over the total of the other), not an average of the rows.`);
  for (const f of spec.filters) lines.push(`Only include rows where \`${f.column}\` ${f.operator} ${typeof f.value === "number" ? f.value : `"${f.value}"`}.`);
  if (spec.limit) lines.push(`Show only the top ${spec.limit} by value.`);
  else if (spec.sort === "measure_desc") lines.push("Order from highest to lowest value.");
  else if (spec.sort === "measure_asc") lines.push("Order from lowest to highest value.");
  lines.push("Pick the chart type that best fits this data.");
  return lines;
}
