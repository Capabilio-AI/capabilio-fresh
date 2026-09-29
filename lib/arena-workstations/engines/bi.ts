import { z } from "zod";
import { type Cell, type Dataset } from "./dataset";

// A constrained BI builder: the candidate's chart is a structured spec. Both
// the expected and the candidate spec are evaluated on the same dataset and
// the resulting series are compared, so equivalent specs pass; the chart type
// must be one that suits the data (server rule, not the AI's say-so).

export const CHART_TYPES = ["bar", "line", "pie", "table"] as const;
export const AGGREGATIONS = ["sum", "avg", "count", "min", "max"] as const;
export const BI_OPERATORS = ["=", "!=", ">", ">=", "<", "<="] as const;
export const SORTS = ["dimension_asc", "measure_desc", "measure_asc"] as const;

export const BiFilterSchema = z.object({ column: z.string(), operator: z.enum(BI_OPERATORS), value: z.union([z.number(), z.string().max(80)]) });
export const BiSpecSchema = z.object({
  chart_type: z.enum(CHART_TYPES),
  dimension: z.string(),
  dimension_grain: z.enum(["value", "month"]).default("value"),
  measure: z.string().nullable(),
  aggregation: z.enum(AGGREGATIONS),
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
  if (spec.aggregation !== "count" && (meas === -1 || ds.columns[meas].type !== "number")) throw new Error("This aggregation needs a numeric measure");
  const filters = spec.filters.map((f) => ({ i: idx(f.column), f }));

  const groups = new Map<string, number[]>();
  for (const row of ds.rows) {
    if (!filters.every(({ i, f }) => matches(row[i], f.operator, f.value))) continue;
    const raw = row[dim];
    if (raw === null) continue;
    const label = spec.dimension_grain === "month" ? String(raw).slice(0, 7) : String(raw);
    const bucket = groups.get(label) ?? [];
    if (spec.aggregation === "count") bucket.push(1);
    else if (typeof row[meas] === "number") bucket.push(row[meas] as number);
    groups.set(label, bucket);
  }

  let series: SeriesPoint[] = [...groups.entries()]
    .filter(([, vals]) => vals.length > 0)
    .map(([label, vals]) => {
      const value =
        spec.aggregation === "count" ? vals.length
        : spec.aggregation === "sum" ? vals.reduce((s, x) => s + x, 0)
        : spec.aggregation === "avg" ? vals.reduce((s, x) => s + x, 0) / vals.length
        : spec.aggregation === "min" ? Math.min(...vals)
        : Math.max(...vals);
      return { label, value: Math.round(value * 100) / 100 };
    });

  series =
    spec.sort === "measure_desc" ? series.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    : spec.sort === "measure_asc" ? series.sort((a, b) => a.value - b.value || a.label.localeCompare(b.label))
    : series.sort((a, b) => a.label.localeCompare(b.label));
  return spec.limit ? series.slice(0, spec.limit) : series;
}

/** Pure. Which chart types honestly fit a series: time → line/bar, few categories → bar/pie, many → bar/table. */
export function suitableChartTypes(ds: Dataset, spec: BiSpec, points: number): (typeof CHART_TYPES)[number][] {
  const dimType = ds.columns.find((c) => c.name === spec.dimension)?.type;
  if (spec.dimension_grain === "month" || dimType === "date") return ["line", "bar"];
  if (points <= 6 && spec.aggregation !== "avg") return ["bar", "pie"];
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

  const checks = [
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
  const lines = [
    spec.aggregation === "count" ? `Show the number of records per \`${spec.dimension}\`${spec.dimension_grain === "month" ? " (by month)" : ""}.` : `Show the ${AGG_LABEL[spec.aggregation]} of \`${spec.measure}\` per \`${spec.dimension}\`${spec.dimension_grain === "month" ? " (by month)" : ""}.`,
  ];
  for (const f of spec.filters) lines.push(`Only include rows where \`${f.column}\` ${f.operator} ${typeof f.value === "number" ? f.value : `"${f.value}"`}.`);
  if (spec.limit) lines.push(`Show only the top ${spec.limit} by value.`);
  else if (spec.sort === "measure_desc") lines.push("Order from highest to lowest value.");
  else if (spec.sort === "measure_asc") lines.push("Order from lowest to highest value.");
  lines.push("Pick the chart type that best fits this data.");
  return lines;
}
