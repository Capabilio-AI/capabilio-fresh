export interface CaseOutput {
  ok: boolean;
  value?: unknown;
  error?: string;
}

// The code runs in a Web Worker, so an endless loop can be terminated and cannot freeze the page.
const WORKER_SOURCE = `
self.onmessage = (e) => {
  const { code, fn, cases } = e.data;
  let f;
  try { f = new Function(code + "\\n;return typeof " + fn + " === 'function' ? " + fn + " : undefined;")(); }
  catch (err) { postMessage({ fatal: String((err && err.message) || err) }); return; }
  if (typeof f !== "function") { postMessage({ fatal: "Define a function named " + fn + "." }); return; }
  const out = cases.map((args) => {
    try {
      const v = f(...args);
      return { ok: true, value: v === undefined ? null : JSON.parse(JSON.stringify(v)) };
    } catch (err) { return { ok: false, error: String((err && err.message) || err).slice(0, 300) }; }
  });
  postMessage({ out });
};`;

/** Runs `fn` from the user's code on every case. Rejects with a readable message when the code does not load or takes longer than the limit. */
export function runJavaScript(code: string, fn: string, cases: unknown[][], timeoutMs: number): Promise<CaseOutput[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" })));
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error(`That took longer than ${Math.round(timeoutMs / 1000)}s and was stopped. Is there an endless loop, or a slow approach for a big input?`));
    }, timeoutMs);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      if (e.data.fatal) reject(new Error(e.data.fatal));
      else resolve(e.data.out as CaseOutput[]);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(e.message || "Your code could not run."));
    };
    worker.postMessage({ code, fn, cases });
  });
}

/** Python source that calls `fn` on every case and leaves the JSON in `_result`. */
export const pythonHarness = (fn: string, cases: unknown[][]) => `import json as _json
_cases = _json.loads(${JSON.stringify(JSON.stringify(cases))})
_out = []
for _a in _cases:
    try:
        _out.append({"ok": True, "value": ${fn}(*_a)})
    except Exception as _e:
        _out.append({"ok": False, "error": str(_e)[:300]})
_result = _json.dumps(_out)
`;

/** Python writes NaN and Infinity, which are not JSON; they become null. */
export const parsePythonResult = (raw: string): CaseOutput[] => JSON.parse(raw.replace(/-?\b(NaN|Infinity)\b/g, "null"));
