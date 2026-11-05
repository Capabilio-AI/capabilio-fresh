import { buildSeedSql } from "@/lib/arena-workstations/engines/seed-sql";
import { runSqlScript } from "@/lib/workplace/sql/local-runner";
import { runSqlQueries, type SqlCell, type SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { SqlTaskDef } from "./sql-bank";

/** What a student sees of a SQL task: the brief and the tables. Never the expected result or the reference query. */
export interface PublicSqlTask {
  v: 2;
  family: "sql";
  /** "query": write one SELECT. "script": write statements (CREATE INDEX, ALTER, UPDATE, triggers ...) graded on the database they leave behind. */
  mode?: "query" | "script";
  /** script tasks: a read-only query shown after Run so the student can see the effect of their script */
  previewQuery?: string;
  /** SQL run once after the tables are built (existing indexes, views) and before the student's script */
  setupSql?: string;
  prompt: string;
  tables: Dataset[];
  /** the editor opens with this */
  starter: string;
  /** true when the task asks for an order the rows must come back in */
  ordered: boolean;
}

/** Server-only: what the answer must be. Stored in arena_challenge_tests as [expected, { ordered }] (that table wants an array of 2-12), never on the challenge row (which is sent to the browser). */
export interface SqlAnswer {
  expected: { columns: string[]; rows: SqlCell[][] };
}

/** A script task's answer: probes (read-only queries, or a statement that must fail) run after the student's script, with the results the reference script gave. */
export interface ScriptAnswer {
  mode: "script";
  probes: string[];
  expected: SqlResult[];
}
export type AnyAnswer = SqlAnswer | ScriptAnswer;
export const isScriptAnswer = (a: AnyAnswer): a is ScriptAnswer => (a as ScriptAnswer).mode === "script";

export const MAX_RESULT_ROWS = 25;
const MAX_QUERY_CHARS = 4000;

export const publicTask = (t: SqlTaskDef): PublicSqlTask => ({ v: 2, family: "sql", prompt: t.prompt, tables: t.tables, starter: `-- ${t.tables.map((x) => x.name).join(", ")}\nSELECT `, ordered: t.ordered });

const seedOf = (tables: Dataset[], setupSql?: string) => (setupSql ? `${buildSeedSql(tables)}\n${setupSql}` : buildSeedSql(tables));

/** Runs the reference query on the task's data and keeps its result as the answer. Returns why not when the task is not usable. */
export async function computeAnswer(t: SqlTaskDef): Promise<{ answer: SqlAnswer } | { reason: string }> {
  const [r] = await runSqlQueries(seedOf(t.tables), [t.query]);
  if ("error" in r) return { reason: `reference failed: ${r.error}` };
  if (r.rows.length < 1) return { reason: "reference returns no rows" };
  if (r.rows.length > MAX_RESULT_ROWS) return { reason: `reference returns ${r.rows.length} rows` };
  if (r.truncated) return { reason: "reference result truncated" };
  return { answer: { expected: { columns: r.columns, rows: r.rows } } };
}

const asNum = (c: SqlCell): number | null => (typeof c === "number" ? c : typeof c === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(c) ? Number(c) : null);
/** `strict`: text must match exactly (DBA tasks are often about exactly that: case, spaces, NULL vs 'Unknown'); otherwise text is compared loosely. */
const same = (a: SqlCell, b: SqlCell, strict = false): boolean => {
  if (a === null || b === null) return a === b;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 1e-6);
  if (strict) return a === b;
  const x = asNum(a), y = asNum(b);
  if (x !== null && y !== null) return Math.abs(x - y) <= Math.max(0.011, Math.abs(y) * 1e-6);
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
};
const sameRow = (a: SqlCell[], b: SqlCell[], strict = false) => a.length === b.length && a.every((c, i) => same(c, b[i], strict));

export interface SqlVerdict { passed: boolean; message: string; rows?: number; expectedRows?: number }

/**
 * Compares the student's result with the stored answer. Column names do not matter (analysts name things their own way) but the
 * values, the number of rows and the column count must match, and the row order must match when the task asked for an order.
 */
export function compareResult(answer: SqlAnswer, actual: SqlResult, ordered: boolean): SqlVerdict {
  if ("error" in actual) return { passed: false, message: `Your query failed: ${actual.error}` };
  const want = answer.expected.rows;
  const base = { rows: actual.rows.length, expectedRows: want.length };
  if (actual.columns.length !== answer.expected.columns.length) return { ...base, passed: false, message: `Your result has ${actual.columns.length} column${actual.columns.length === 1 ? "" : "s"}; the task asks for ${answer.expected.columns.length}.` };
  if (actual.rows.length !== want.length) return { ...base, passed: false, message: `Your result has ${actual.rows.length} row${actual.rows.length === 1 ? "" : "s"}; the expected result has ${want.length}.` };
  if (ordered) {
    const bad = want.findIndex((row, i) => !sameRow(row, actual.rows[i]));
    return bad === -1 ? { ...base, passed: true, message: "Correct." } : { ...base, passed: false, message: `Row ${bad + 1} is not what the task expects. Check the values and the ORDER BY.` };
  }
  const left = [...actual.rows];
  for (const row of want) {
    const at = left.findIndex((r) => sameRow(r, row));
    if (at === -1) return { ...base, passed: false, message: "Some rows do not match the expected result. Check the filter, the grouping and the rounding." };
    left.splice(at, 1);
  }
  return { ...base, passed: true, message: "Correct." };
}

/** One read-only statement only: the editor is for questions, not for changing the data. */
export function validateQuery(query: string): string | null {
  const q = query.trim().replace(/;\s*$/, "");
  if (!q) return "Write a query first.";
  if (q.length > MAX_QUERY_CHARS) return "That query is too long.";
  if (q.includes(";")) return "Run one statement at a time.";
  if (!/^(select|with)\b/i.test(q)) return "Only SELECT queries (or WITH … SELECT) are allowed here.";
  return null;
}

/** Runs the student's query on a fresh copy of the task's data. */
export async function runStudentQuery(tables: Dataset[], query: string, setupSql?: string): Promise<SqlResult> {
  const problem = validateQuery(query);
  if (problem) return { error: problem };
  const [r] = await runSqlQueries(seedOf(tables, setupSql), [query.trim().replace(/;\s*$/, "")]);
  return r;
}

// ---------- DBA script tasks ----------

const FORBIDDEN_SCRIPT = /\b(attach|detach|pragma|load_extension|vacuum)\b/i;
const MAX_SCRIPT_CHARS = 6000;

/** Statements that change the schema or the data are the point of a DBA task; reaching outside this database is not allowed. */
export function validateScript(script: string): string | null {
  const text = script.trim();
  if (!text) return "Write your statements first.";
  if (text.length > MAX_SCRIPT_CHARS) return "That script is too long.";
  if (FORBIDDEN_SCRIPT.test(text)) return "ATTACH, DETACH, PRAGMA, VACUUM and extensions are not allowed here.";
  return null;
}

const sameResult = (want: SqlResult, got: SqlResult): boolean => {
  if ("error" in want) return "error" in got; // a probe that must be rejected: the message does not matter
  if ("error" in got) return false;
  if (want.rows.length !== got.rows.length || (want.rows[0]?.length ?? 0) !== (got.rows[0]?.length ?? 0)) return false;
  return want.rows.every((row, i) => sameRow(row, got.rows[i], true));
};

/** Runs a reference script on the task's data and keeps what each probe returns. */
export async function computeScriptAnswer(tables: Dataset[], setupSql: string | undefined, script: string, probes: string[]): Promise<{ answer: ScriptAnswer } | { reason: string }> {
  const run = await runSqlScript(seedOf(tables, setupSql), script, probes);
  if (run.scriptError) return { reason: `reference script failed: ${run.scriptError}` };
  return { answer: { mode: "script", probes, expected: run.probes } };
}

/** Runs the student's script on a fresh copy of the data, then the probes (and the preview query) on what it left behind. */
export async function judgeScript(task: PublicSqlTask, answer: ScriptAnswer, script: string): Promise<{ verdict: SqlVerdict; preview?: SqlResult }> {
  const bad = validateScript(script);
  if (bad) return { verdict: { passed: false, message: bad } };
  const probes = task.previewQuery ? [...answer.probes, task.previewQuery] : answer.probes;
  const run = await runSqlScript(seedOf(task.tables, task.setupSql), script, probes);
  if (run.scriptError) return { verdict: { passed: false, message: `Your script failed: ${run.scriptError}` } };
  const failed = answer.expected.findIndex((want, i) => !sameResult(want, run.probes[i]));
  const preview = task.previewQuery ? run.probes[answer.probes.length] : undefined;
  return { verdict: failed === -1 ? { passed: true, message: "Correct." } : { passed: false, message: `The database your script leaves behind is not what the task asks for (check ${failed + 1} of ${answer.probes.length} failed). Re-read the task: names, columns and values must match.` }, preview };
}

/** One entry point for both kinds of SQL task: the student's text is a query or a script depending on the task. */
export async function judgeSql(task: PublicSqlTask, answer: AnyAnswer, text: string): Promise<{ verdict: SqlVerdict; table?: SqlResult }> {
  if (isScriptAnswer(answer)) {
    const r = await judgeScript(task, answer, text);
    return { verdict: r.verdict, table: r.preview };
  }
  const result = await runStudentQuery(task.tables, text, task.setupSql);
  return { verdict: compareResult(answer, result, task.ordered), table: result };
}
