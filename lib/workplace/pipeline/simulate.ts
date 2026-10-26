import type { PipelineSpec, QualityCheck } from "./spec";
import { FLAKY_DAY, INGESTED_AT, UPDATED_AT, baseColumns, buildSource, dayDate, type Row, type Scenario, type Source, type Value } from "./scenario";

/**
 * Runs a pipeline spec over the scenario's daily batches, deterministically, in plain TypeScript: extract (full or from a watermark), retry a flaky
 * extract, handle a schema change, de-duplicate, run the quality gate, then write (append / merge / overwrite / overwrite partitions). After the daily
 * runs it re-runs every day as a backfill to see whether the output is the same. A model of the ideas, not Spark or Airflow: nothing runs on a cluster.
 */
export interface RunLog {
  label: string;
  day: number;
  status: "success" | "failed" | "blocked";
  reason?: string;
  attempts: number;
  extracted: number;
  duplicatesDropped: number;
  written: number;
}
export interface TableSummary {
  rows: number;
  columns: string[];
  duplicateKeys: number;
  nullKeys: number;
  partitions: { value: string; rows: number }[];
}
export interface Simulation {
  errors: string[];
  runs: RunLog[];
  backfill: RunLog[];
  final: Row[];
  columns: string[];
  summary: TableSummary;
  /** the backfill left exactly the same table */
  rerunSame: boolean;
  /** a report for day 2's date: rows read with the table's partitioning vs rows it needs */
  pruning: { scanned: number; needed: number; total: number };
}

interface State {
  rows: Row[];
  columns: string[];
  wm: number | null;
}

const HOUR = 3_600_000;
const MAX_SIMULATED_RETRIES = 10;

export const retryCount = (spec: PipelineSpec): number => {
  const max = spec.retries?.max;
  return typeof max === "number" && Number.isFinite(max) ? Math.max(0, Math.floor(max)) : typeof max === "string" ? MAX_SIMULATED_RETRIES : 0;
};

/** Problems that stop the spec from running at all, against this scenario's source. */
export function specProblems(spec: PipelineSpec, s: Scenario, src: Source): string[] {
  const d = s.dataset;
  const cols = new Set(src.columns);
  const p: string[] = [];
  const known = (c: string | undefined, what: string) => c !== undefined && !cols.has(c) && p.push(`${what} \`${c}\` is not a column of ${d.source}`);
  if (spec.source !== d.source) p.push(`source must be ${d.source} (the table the batches land in)`);
  if (spec.load.mode === "incremental" && !spec.load.watermark) p.push("an incremental load needs load.watermark");
  if (spec.load.watermark && ![UPDATED_AT, INGESTED_AT].includes(spec.load.watermark)) p.push(`load.watermark must be a timestamp column (${UPDATED_AT} or ${INGESTED_AT})`);
  if (spec.load.write === "merge" && !spec.load.unique_key) p.push("a merge needs load.unique_key");
  if (spec.load.write === "overwrite_partitions" && !spec.target.partition_by) p.push("overwrite_partitions needs target.partition_by");
  known(spec.load.unique_key, "load.unique_key");
  known(spec.load.order_by, "load.order_by");
  known(spec.target.partition_by, "target.partition_by");
  known(spec.target.bucket_by, "target.bucket_by");
  for (const c of spec.quality?.checks ?? []) if (c.check !== "row_count_min") known(c.column, `quality check ${c.check} on`);
  return p;
}

const keyOf = (r: Row, col: string) => String(r[col]);
const ts = (v: Value) => (typeof v === "string" ? Date.parse(v) : NaN);

function violates(c: QualityCheck, rows: Row[]): boolean {
  switch (c.check) {
    case "not_null": return rows.some((r) => r[c.column] === null || r[c.column] === undefined);
    case "unique": return new Set(rows.map((r) => keyOf(r, c.column))).size !== rows.length;
    case "min": return rows.some((r) => typeof r[c.column] === "number" && (r[c.column] as number) < c.value);
    case "accepted_values": return rows.some((r) => r[c.column] !== null && r[c.column] !== undefined && !c.values.map(String).includes(String(r[c.column])));
    case "row_count_min": return rows.length < c.value;
  }
}

/** Keep one row per key: the newest by order_by (later arrivals win a tie). */
function dedupe(rows: Row[], key: string | undefined, orderBy: string | undefined): Row[] {
  if (!key) return rows;
  const best = new Map<string, Row>();
  for (const r of rows) {
    const k = keyOf(r, key);
    const prev = best.get(k);
    if (!prev || !orderBy || String(r[orderBy] ?? "") >= String(prev[orderBy] ?? "")) best.set(k, r);
  }
  return [...best.values()];
}

function write(spec: PipelineSpec, rows: Row[], batch: Row[]): Row[] {
  const { write: mode, unique_key: key } = spec.load;
  if (mode === "append") return [...rows, ...batch];
  if (mode === "overwrite") return batch;
  if (mode === "overwrite_partitions") {
    const col = spec.target.partition_by!;
    const touched = new Set(batch.map((r) => keyOf(r, col)));
    return [...rows.filter((r) => !touched.has(keyOf(r, col))), ...batch];
  }
  const incoming = new Map(batch.map((r) => [keyOf(r, key!), r]));
  return [...rows.filter((r) => !incoming.has(keyOf(r, key!))), ...batch];
}

function runDay(spec: PipelineSpec, s: Scenario, src: Source, state: State, day: number, label: string): { state: State; log: RunLog } {
  const retries = retryCount(spec);
  const flaky = day === FLAKY_DAY ? s.flaky : 0;
  const base = { label, day, attempts: Math.min(flaky, retries) + 1, extracted: 0, duplicatesDropped: 0, written: 0 };
  if (retries < flaky) return { state, log: { ...base, status: "failed", reason: `extract failed ${base.attempts} time${base.attempts === 1 ? "" : "s"}; no retries left` } };
  const landed = src.batches.filter((b) => b.day <= day).flatMap((b) => b.rows);
  const wmCol = spec.load.watermark;
  const from = spec.load.mode === "incremental" && state.wm !== null ? state.wm - (spec.load.lookback_hours ?? 0) * HOUR : null;
  let rows = from === null ? landed : landed.filter((r) => ts(r[wmCol!]) > from);

  const known = new Set([...baseColumns(s.dataset), ...state.columns]);
  const added = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => !known.has(c));
  const onChange = spec.load.on_schema_change ?? "ignore";
  if (added.length && onChange === "fail") return { state, log: { ...base, extracted: rows.length, status: "failed", reason: `schema changed: new column ${added.join(", ")}` } };
  if (added.length && onChange === "ignore") rows = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([c]) => !added.includes(c))));
  const columns = onChange === "append_new_columns" ? [...state.columns, ...added] : state.columns;

  const batch = dedupe(rows, spec.load.unique_key, spec.load.order_by);
  const log = { ...base, extracted: rows.length, duplicatesDropped: rows.length - batch.length };
  const failed = (spec.quality?.checks ?? []).filter((c) => violates(c, batch));
  if (failed.length && (spec.quality?.on_fail ?? "warn") === "block") return { state, log: { ...log, status: "blocked", reason: `quality gate: ${failed.map((c) => c.check + ("column" in c ? ` ${c.column}` : "")).join(", ")} failed` } };

  const wms = rows.map((r) => ts(r[wmCol ?? INGESTED_AT])).filter((n) => !Number.isNaN(n));
  const wm = wms.length ? Math.max(state.wm ?? -Infinity, ...wms) : state.wm;
  const reason = failed.length ? `quality warnings: ${failed.map((c) => c.check).join(", ")} (loaded anyway)` : undefined;
  return { state: { rows: write(spec, state.rows, batch), columns, wm }, log: { ...log, written: batch.length, status: "success", ...(reason ? { reason } : {}) } };
}

const canonical = (rows: Row[]) => rows.map((r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]))).sort().join("\n");

function summarise(spec: PipelineSpec, s: Scenario, rows: Row[], columns: string[]): TableSummary {
  const key = s.dataset.key;
  const keys = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined).map(String);
  const col = spec.target.partition_by;
  const groups = new Map<string, number>();
  for (const r of rows) {
    const v = col ? String(r[col] ?? "null") : "(not partitioned)";
    groups.set(v, (groups.get(v) ?? 0) + 1);
  }
  return {
    rows: rows.length,
    columns: [...baseColumns(s.dataset), ...columns],
    duplicateKeys: keys.length - new Set(keys).size,
    nullKeys: rows.length - keys.length,
    partitions: [...groups].map(([value, n]) => ({ value, rows: n })).sort((a, b) => a.value.localeCompare(b.value)),
  };
}

export function simulate(spec: PipelineSpec, s: Scenario): Simulation {
  const src = buildSource(s);
  const empty: State = { rows: [], columns: [], wm: null };
  const errors = specProblems(spec, s, src);
  if (errors.length) return { errors, runs: [], backfill: [], final: [], columns: [], summary: summarise(spec, s, [], []), rerunSame: false, pruning: { scanned: 0, needed: 0, total: 0 } };

  let state = empty;
  const before: State[] = [];
  const runs: RunLog[] = [];
  for (const b of src.batches) {
    before.push(state);
    const r = runDay(spec, s, src, state, b.day, `Day ${b.day}`);
    state = r.state;
    runs.push(r.log);
  }
  // a backfill re-runs each day from the watermark that day started with, on top of the table as it is now
  let again = state;
  const backfill: RunLog[] = [];
  src.batches.forEach((b, i) => {
    const r = runDay(spec, s, src, { ...again, wm: before[i].wm }, b.day, `Re-run day ${b.day}`);
    again = r.state;
    backfill.push(r.log);
  });

  const col = spec.target.partition_by;
  const report = dayDate(2);
  const needed = state.rows.filter((r) => r[s.dataset.eventDate] === report).length;
  return {
    errors,
    runs,
    backfill,
    final: state.rows,
    columns: state.columns,
    summary: summarise(spec, s, state.rows, state.columns),
    rerunSame: canonical(state.rows) === canonical(again.rows),
    pruning: { scanned: col === s.dataset.eventDate ? needed : state.rows.length, needed, total: state.rows.length },
  };
}
