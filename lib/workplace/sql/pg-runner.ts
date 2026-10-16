import { Worker } from "node:worker_threads";
import path from "node:path";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import { LocalRunnerUnavailable, MAX_ROWS, type ScriptRun } from "./local-runner";

// Real PostgreSQL (PGlite, WebAssembly) in a worker thread, for tickets that need stored functions, triggers, privileges and the like.
// Every call boots from a pre-built data-directory snapshot (about 0.7 s; from scratch it is 3-10 s), builds the seed, and is
// terminated if it runs past the limit. Nothing a script does can leave the worker.

/** The time a run may take. Tests that start many databases at once raise it with PG_TIMEOUT_MS. */
const defaultTimeout = () => Number(process.env.PG_TIMEOUT_MS) || 8000;
const TOO_LONG = "The script took too long and was stopped.";

const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs");
const { PGlite } = require(workerData.entry);

const message = (e) => String(e && e.message ? e.message : e);
const cell = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return null;
  return JSON.stringify(v);
};
// Postgres hands back numeric / bigint / float columns as strings or bigints; the graders and the screen want plain numbers.
const NUMERIC_TYPES = new Set([20, 21, 23, 700, 701, 1700]);
async function readAll(db, sql, maxRows) {
  const r = await db.query(sql, [], { rowMode: "array" });
  const numeric = r.fields.map((f) => NUMERIC_TYPES.has(f.dataTypeID));
  const rows = r.rows.slice(0, maxRows).map((row) => row.map((v, i) => (numeric[i] && v !== null && v !== undefined ? Number(v) : cell(v))));
  return { columns: r.fields.map((f) => f.name), rows, truncated: r.rows.length > maxRows };
}

(async () => {
  const db = new PGlite({ loadDataDir: new Blob([fs.readFileSync(workerData.snapshot)]) });
  await db.waitReady;
  try {
    if (workerData.seed) await db.exec(workerData.seed);
    if (workerData.mode === "script") {
      try { await db.exec(workerData.script); } catch (e) { parentPort.postMessage({ scriptError: message(e), probes: [] }); return; }
      const probes = [];
      for (const sql of workerData.probes) {
        try { probes.push(await readAll(db, sql, workerData.maxRows)); } catch (e) { probes.push({ error: message(e) }); }
      }
      parentPort.postMessage({ scriptError: null, probes });
    } else {
      const out = [];
      for (const sql of workerData.queries) {
        try { out.push(await readAll(db, sql, workerData.maxRows)); } catch (e) { out.push({ error: message(e) }); }
      }
      parentPort.postMessage(out);
    }
  } catch (e) {
    parentPort.postMessage(workerData.mode === "script" ? { scriptError: message(e), probes: [] } : [{ error: message(e) }]);
  } finally {
    try { await db.close(); } catch (e) { /* the worker is ending anyway */ }
  }
})().catch((e) => parentPort.postMessage({ error: message(e) }));
`;

function paths() {
  const root = process.cwd();
  return {
    entry: path.join(root, "node_modules", "@electric-sql/pglite", "dist", "index.cjs"),
    snapshot: path.join(root, "lib", "workplace", "sql", "assets", "pg-template.tgz"),
  };
}

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
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { maxRows: MAX_ROWS, ...paths(), ...data }, resourceLimits: { maxOldGenerationSizeMb: 512 } });
    const timer = setTimeout(() => finish(() => resolve(onTimeout)), timeoutMs);
    worker.once("message", (m: T) => finish(() => resolve(m)));
    worker.once("error", (e) => finish(() => reject(new LocalRunnerUnavailable(e.message))));
    worker.once("exit", (code) => finish(() => reject(new LocalRunnerUnavailable(`worker exited with ${code}`))));
  });
}

/** One result per query, run in order on one fresh Postgres built from the seed. */
export async function runPgQueries(seedSql: string, queries: string[], opts: { timeoutMs?: number } = {}): Promise<SqlResult[]> {
  const timedOut: SqlResult[] = queries.map(() => ({ error: TOO_LONG }));
  return runWorker<SqlResult[]>({ mode: "queries", seed: seedSql, queries }, opts.timeoutMs ?? defaultTimeout(), timedOut);
}

/** Builds the seed, runs the user's whole script, then the probes in order on the result (a probe may change data first). */
export async function runPgScript(seedSql: string, script: string, probes: string[], opts: { timeoutMs?: number } = {}): Promise<ScriptRun> {
  return runWorker<ScriptRun>({ mode: "script", seed: seedSql, script, probes }, opts.timeoutMs ?? defaultTimeout(), { scriptError: TOO_LONG, probes: [] });
}
