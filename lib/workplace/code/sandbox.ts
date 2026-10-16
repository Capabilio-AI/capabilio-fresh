import { Worker } from "node:worker_threads";

export interface CaseResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_RUN_MS = 3000;

// The worker has no require, no process access from the code and no string-to-code (eval / Function), and the whole run is cut off by a hard timeout.
// The code it runs is written by our own AI generator and checked here; the learner's code never reaches the server.
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const vm = require("node:vm");
const { source, fn, cases, ms } = workerData;
try {
  const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  context.__cases = JSON.stringify(cases);
  vm.runInContext(source, context, { timeout: ms });
  const run = "(function () { const __f = typeof " + fn + " === 'function' ? " + fn + " : undefined; if (!__f) return JSON.stringify({ fatal: 'missing function' }); const out = []; for (const a of JSON.parse(__cases)) { try { const v = __f(...a); out.push({ ok: true, value: v === undefined ? null : v }); } catch (e) { out.push({ ok: false, error: String((e && e.message) || e).slice(0, 200) }); } } return JSON.stringify(out); })()";
  parentPort.postMessage(JSON.parse(vm.runInContext(run, context, { timeout: ms })));
} catch (e) {
  parentPort.postMessage({ fatal: String((e && e.message) || e).slice(0, 200) });
}`;

/** Runs `fn` from `source` on every case in an isolated worker. Rejects when the code does not load, is missing the function, or runs too long. */
export function runInSandbox(source: string, fn: string, cases: unknown[][], ms = MAX_RUN_MS): Promise<CaseResult[]> {
  if (!NAME.test(fn)) return Promise.reject(new Error("bad function name"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { source, fn, cases, ms }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("the code ran too long"));
    }, ms + 1500);
    worker.once("message", (m) => {
      clearTimeout(timer);
      void worker.terminate();
      if (m && !Array.isArray(m) && m.fatal) reject(new Error(m.fatal));
      else resolve(m as CaseResult[]);
    });
    worker.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}
