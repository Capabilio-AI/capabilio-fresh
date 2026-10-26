import type { CheckResult } from "../file-tasks/types";
import { parseSpec, type PipelineSpec } from "./spec";
import { retryCount, simulate, type Simulation } from "./simulate";
import { UPDATED_AT, buildSource, type Row, type Scenario } from "./scenario";

/**
 * The invariants a ticket grades, checked on the simulated output and the spec. The student sees only each check's label and whether it passed;
 * the ticket's key (which checks, limits such as the partition ceiling) stays on the server.
 */
export type Check =
  | { id: "dag_valid"; label: string }
  | { id: "dag_order"; label: string; before: string; after: string }
  | { id: "schedule_daily"; label: string }
  | { id: "complete"; label: string }
  | { id: "no_duplicates"; label: string }
  | { id: "late_data"; label: string }
  | { id: "idempotent"; label: string }
  | { id: "quality_blocks"; label: string }
  | { id: "schema_drift"; label: string }
  | { id: "retries_bounded"; label: string }
  | { id: "runs_recover"; label: string }
  | { id: "partition_pruning"; label: string; maxPartitions: number }
  | { id: "columnar"; label: string }
  | { id: "bucketing"; label: string; column: string; min: number; max: number };

export const MAX_RETRIES = 5;
const COLUMNAR = ["parquet", "orc", "delta", "iceberg"];

/** Topological order of the tasks, or null when a dependency is missing or there is a cycle. */
export function taskOrder(tasks: PipelineSpec["tasks"]): string[] | null {
  const ids = tasks.map((t) => t.id);
  if (new Set(ids).size !== ids.length) return null;
  if (tasks.some((t) => (t.depends_on ?? []).some((d) => !ids.includes(d) || d === t.id))) return null;
  const order: string[] = [];
  let left = tasks;
  while (left.length) {
    const ready = left.filter((t) => (t.depends_on ?? []).every((d) => order.includes(d)));
    if (!ready.length) return null;
    order.push(...ready.map((t) => t.id));
    left = left.filter((t) => !ready.includes(t));
  }
  return order;
}

/** True when `after` depends on `before`, directly or through other tasks. */
function dependsOn(tasks: PipelineSpec["tasks"], after: string, before: string): boolean {
  const seen = new Set<string>();
  const walk = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    const deps = tasks.find((t) => t.id === id)?.depends_on ?? [];
    return deps.includes(before) || deps.some(walk);
  };
  return walk(after);
}

const CRON_NUMBER = /^\d{1,2}$/;
export function isDaily(schedule: string | undefined): boolean {
  if (!schedule) return false;
  if (schedule.trim() === "@daily") return true;
  const f = schedule.trim().split(/\s+/);
  return f.length === 5 && CRON_NUMBER.test(f[0]) && Number(f[0]) < 60 && CRON_NUMBER.test(f[1]) && Number(f[1]) < 24 && f.slice(2).every((x) => x === "*");
}

/** The table a correct pipeline ends with: the newest version of every key from the batches that are not corrupt. */
export function expectedTable(s: Scenario): Map<string, Row> {
  const key = s.dataset.key;
  const best = new Map<string, Row>();
  for (const r of buildSource(s).batches.filter((b) => !b.bad).flatMap((b) => b.rows)) {
    const k = String(r[key]);
    const prev = best.get(k);
    if (!prev || String(r[UPDATED_AT]) >= String(prev[UPDATED_AT])) best.set(k, r);
  }
  return best;
}

function matchesExpected(s: Scenario, sim: Simulation): boolean {
  const d = s.dataset;
  const want = expectedTable(s);
  if (sim.final.length !== want.size) return false;
  return sim.final.every((r) => {
    const w = want.get(String(r[d.key]));
    return !!w && w[d.measure] === r[d.measure] && w[UPDATED_AT] === r[UPDATED_AT] && w[d.eventDate] === r[d.eventDate];
  });
}

function passes(c: Check, spec: PipelineSpec, s: Scenario, sim: Simulation): boolean {
  const d = s.dataset;
  const src = buildSource(s);
  const has = (key: number) => sim.final.some((r) => r[d.key] === key);
  const badDay = src.batches.find((b) => b.bad)?.day;
  switch (c.id) {
    case "dag_valid": return taskOrder(spec.tasks) !== null;
    case "dag_order": return taskOrder(spec.tasks) !== null && dependsOn(spec.tasks, c.after, c.before);
    case "schedule_daily": return isDaily(spec.schedule);
    case "complete": return matchesExpected(s, sim);
    case "no_duplicates": return sim.final.length > 0 && sim.summary.duplicateKeys === 0;
    case "late_data": return src.lateKeys.length > 0 && src.lateKeys.every(has);
    case "idempotent": return sim.final.length > 0 && sim.rerunSame;
    case "quality_blocks": return badDay !== undefined && sim.runs.some((r) => r.day === badDay && r.status === "blocked") && sim.final.length > 0 && sim.final.every((r) => r[d.key] !== null && (r[d.measure] as number) >= 0);
    case "schema_drift": return src.driftKeys.length > 0 && sim.summary.columns.includes(d.driftColumn) && src.driftKeys.every(has);
    case "retries_bounded": {
      const max = spec.retries?.max;
      const delay = spec.retries?.delay_minutes;
      return typeof max === "number" && Number.isInteger(max) && max >= 1 && max <= MAX_RETRIES && typeof delay === "number" && delay >= 1 && retryCount(spec) === max;
    }
    case "runs_recover": return sim.runs.length > 0 && sim.runs.every((r) => r.status === "success" || (r.day === badDay && r.status === "blocked"));
    case "partition_pruning": return sim.final.length > 0 && sim.pruning.scanned === sim.pruning.needed && sim.summary.partitions.length <= c.maxPartitions;
    case "columnar": return COLUMNAR.includes((spec.target.format ?? "").toLowerCase());
    case "bucketing": return spec.target.bucket_by === c.column && typeof spec.target.buckets === "number" && spec.target.buckets >= c.min && spec.target.buckets <= c.max;
  }
}

export interface PipelineGrade {
  checks: CheckResult[];
  /** the student's own run, safe to show: never the expected table */
  simulation: Simulation | null;
  error: string | null;
}

/** Parse, simulate and check. A spec that cannot be read or run fails every check, with the reason. */
export function gradePipeline(text: string, s: Scenario, checks: readonly Check[]): PipelineGrade {
  const fail = (error: string): PipelineGrade => ({ checks: checks.map((c) => ({ label: c.label, passed: false })), simulation: null, error });
  const parsed = parseSpec(text);
  if (!parsed.ok) return fail(parsed.error);
  const sim = simulate(parsed.spec, s);
  if (sim.errors.length) return { ...fail(sim.errors.join("; ")), simulation: sim };
  return { checks: checks.map((c) => ({ label: c.label, passed: passes(c, parsed.spec, s, sim) })), simulation: sim, error: null };
}
