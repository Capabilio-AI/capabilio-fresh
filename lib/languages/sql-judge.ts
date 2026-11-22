import { buildSeedSql } from "@/lib/arena-workstations/engines/seed-sql";
import type { SqlCell, SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import { hasSecondStatement, runSqlLocal, runSqlScript } from "@/lib/workplace/sql/local-runner";
import type { SqlChallenge } from "./types";

export const MAX_SQL_CHARS = 6000;
type Table = Extract<SqlResult, { rows: unknown[][] }>;
const isTable = (r: SqlResult | undefined): r is Table => !!r && !("error" in r);

const norm = (c: SqlCell): string => (c === null ? "\u0000null" : typeof c === "number" ? String(Math.round(c * 10000) / 10000) : /^\s*-?\d+(\.\d+)?\s*$/.test(c) ? String(Math.round(Number(c) * 10000) / 10000) : c);
const rowKey = (r: SqlCell[]) => JSON.stringify(r.map(norm));

/** Pure. Whether two result tables hold the same rows: column names are ignored, numbers match to four decimals, and row order counts only when `ordered`. */
export function sameResult(expected: Table, actual: Table, ordered: boolean): boolean {
  if (expected.rows.length !== actual.rows.length) return false;
  if (expected.rows.some((r) => r.length !== (actual.rows[0]?.length ?? r.length)) || (expected.columns.length !== actual.columns.length)) return false;
  const a = expected.rows.map(rowKey);
  const b = actual.rows.map(rowKey);
  return ordered ? a.every((k, i) => k === b[i]) : JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

export interface SqlRunRow { index: number; passed: boolean; hidden: boolean; message?: string; expected?: { columns: string[]; rows: SqlCell[][] }; actual?: { columns: string[]; rows: SqlCell[][] } }
const show = (t: Table) => ({ columns: t.columns, rows: t.rows.slice(0, 15) });

/** Compares one dataset: the student's answer against the reference run on the same data. */
async function compare(ch: SqlChallenge, datasetIndex: number, student: string): Promise<{ passed: boolean; message?: string; expected?: Table; actual?: Table }> {
  const seed = buildSeedSql(ch.datasets[datasetIndex]);
  if (ch.mode === "query") {
    if (hasSecondStatement(student)) return { passed: false, message: "Write one query only." };
    const [exp, act] = await runSqlLocal(seed, [ch.reference, student]);
    if (!isTable(exp)) throw new Error(`reference failed on dataset ${datasetIndex}: ${(exp as { error: string }).error}`);
    if (!isTable(act)) return { passed: false, message: `Your query failed: ${(act as { error: string }).error}`, expected: exp };
    return { passed: sameResult(exp, act, ch.ordered), expected: exp, actual: act };
  }
  const [exp, act] = await Promise.all([runSqlScript(seed, ch.reference, ch.probes), runSqlScript(seed, student, ch.probes)]);
  if (exp.scriptError) throw new Error(`reference script failed on dataset ${datasetIndex}: ${exp.scriptError}`);
  if (act.scriptError) return { passed: false, message: `Your script failed: ${act.scriptError}` };
  for (let i = 0; i < ch.probes.length; i++) {
    const e = exp.probes[i];
    const a = act.probes[i];
    if (!isTable(e)) throw new Error(`probe ${i} failed on the reference: ${(e as { error: string }).error}`);
    if (!isTable(a)) return { passed: false, message: `After your script, a check could not run: ${(a as { error: string }).error}. Names matter: use exactly the table and column names in the task.` };
    if (!sameResult(e, a, true)) return { passed: false, message: "The database your script leaves is not what the task asks for.", expected: e, actual: a };
  }
  return { passed: true };
}

/** Judges a student's SQL. "run" uses only the visible data and shows both results; "submit" uses every dataset and shows detail only for the visible one. */
export async function judgeSqlChallenge(ch: SqlChallenge, student: string, scope: "run" | "submit"): Promise<{ passed: boolean; rows: SqlRunRow[] }> {
  if (student.length > MAX_SQL_CHARS) return { passed: false, rows: [{ index: 0, passed: false, hidden: false, message: "That is too long." }] };
  const indexes = scope === "run" ? [0] : ch.datasets.map((_, i) => i);
  const rows: SqlRunRow[] = [];
  for (const i of indexes) {
    const r = await compare(ch, i, student);
    const visible = i === 0;
    rows.push({ index: i, passed: r.passed, hidden: !visible, ...(visible ? { message: r.message, expected: r.expected && show(r.expected), actual: r.actual && show(r.actual) } : {}) });
  }
  return { passed: rows.every((r) => r.passed), rows };
}
