import { Worker } from "node:worker_threads";
import path from "node:path";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";

export const MAX_ROWS = 500;
export const DEFAULT_TIMEOUT_MS = 3000;
const TOO_LONG = "Query took too long (over 3 seconds) and was stopped.";
const ONE_STATEMENT = "You can only execute one statement at a time.";

/** Thrown when the worker could not even start (missing files); callers may fall back to another runner. */
export class LocalRunnerUnavailable extends Error {}

// Runs inside a worker thread so a runaway query can be killed without blocking the server. Each query gets its own fresh in-memory
// database built from the seed; rows are streamed and cut at the cap so a huge result never fills memory.
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const initSqlJs = require(workerData.sqlJsEntry);

function readAll(db, sql, maxRows) {
  const stmt = db.prepare(sql);
  const columns = stmt.getColumnNames();
  const rows = [];
  let truncated = false;
  while (stmt.step()) {
    if (rows.length >= maxRows) { truncated = true; break; }
    rows.push(stmt.get().map((v) => (v instanceof Uint8Array ? null : v)));
  }
  stmt.free();
  return { columns, rows, truncated };
}
const message = (e) => String(e && e.message ? e.message : e);

(async () => {
  const SQL = await initSqlJs({ locateFile: (f) => workerData.distDir + f });
  const db = new SQL.Database();
  try {
    if (workerData.seed) db.run(workerData.seed);
    if (workerData.mode === "script") {
      try { db.run(workerData.script); } catch (e) { parentPort.postMessage({ scriptError: message(e), probes: [] }); return; }
      const probes = [];
      for (const sql of workerData.probes) {
        try { probes.push(readAll(db, sql, workerData.maxRows)); } catch (e) { probes.push({ error: message(e) }); }
      }
      parentPort.postMessage({ scriptError: null, probes });
    } else {
      parentPort.postMessage(readAll(db, workerData.query, workerData.maxRows));
    }
  } catch (e) {
    parentPort.postMessage(workerData.mode === "script" ? { scriptError: message(e), probes: [] } : { error: message(e) });
  } finally {
    db.close();
  }
})();
`;

/** True when the text holds a statement separator outside quotes followed by more SQL. */
export function hasSecondStatement(sql: string): boolean {
  let quote: string | null = null;
  const text = sql.trim();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === ";" && text.slice(i + 1).trim().length > 0) {
      return true;
    }
  }
  return false;
}

function resolvePaths() {
  const distDir = path.join(process.cwd(), "node_modules", "sql.js", "dist") + path.sep;
  return { distDir, sqlJsEntry: path.join(distDir, "sql-wasm.js") };
}

/** Runs the worker once and resolves with its message, or with `onTimeout` if it does not answer in time. */
function runWorker<T>(data: Record<string, unknown>, timeoutMs: number, onTimeout: T): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { maxRows: MAX_ROWS, ...resolvePaths(), ...data }, resourceLimits: { maxOldGenerationSizeMb: 192 } });
    const timer = setTimeout(() => finish(() => resolve(onTimeout)), timeoutMs);
    worker.once("message", (m: T) => finish(() => resolve(m)));
    worker.once("error", (e) => finish(() => reject(new LocalRunnerUnavailable(e.message))));
    worker.once("exit", (code) => finish(() => (code === 0 ? resolve({ error: "The query stopped unexpectedly." } as T) : reject(new LocalRunnerUnavailable(`worker exited with ${code}`)))));
  });
}

function runOne(seed: string, query: string, timeoutMs: number): Promise<SqlResult> {
  if (hasSecondStatement(query)) return Promise.resolve({ error: ONE_STATEMENT });
  return runWorker<SqlResult>({ mode: "query", seed, query }, timeoutMs, { error: TOO_LONG });
}

export interface ScriptRun {
  /** null when the script ran to the end */
  scriptError: string | null;
  /** one result per probe, in order; a probe that changes data returns no rows. Empty when the script failed. */
  probes: SqlResult[];
}

/**
 * Builds the database from the seed, runs the user's whole script on it, then runs the probes in order on the result. A probe may
 * change data first (to fire a trigger) and a later one read the effect. A fresh database every call, a hard time limit overall.
 */
export async function runSqlScript(seedSql: string, script: string, probes: string[], opts: { timeoutMs?: number } = {}): Promise<ScriptRun> {
  return runWorker<ScriptRun>({ mode: "script", seed: seedSql, script, probes }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, { scriptError: TOO_LONG, probes: [] });
}

/** Same contract as the old Wandbox runner: one result per query, errors as `{ error }`, never more than MAX_ROWS rows. */
export async function runSqlLocal(seedSql: string, queries: string[], opts: { timeoutMs?: number } = {}): Promise<SqlResult[]> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Promise.all(queries.map((q) => runOne(seedSql, q, timeoutMs)));
}
