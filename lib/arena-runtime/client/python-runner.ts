// Pyodide (MPL-2.0) runs in a Web Worker so a runaway cell can be terminated; nothing student-written touches the app's own origin.
// The runtime and its packages are fetched from the Pyodide CDN; the worker has no other network use unless a challenge lists dataset URLs.
export const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const WORKER_SOURCE = `
let pyodide = null;
let out = [];
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      importScripts(m.indexURL + "pyodide.js");
      pyodide = await loadPyodide({ indexURL: m.indexURL });
      pyodide.setStdout({ batched: (s) => out.push(s) });
      pyodide.setStderr({ batched: (s) => out.push(s) });
      if (m.packages.length) await pyodide.loadPackage(m.packages);
      for (const f of m.files) {
        const text = f.url ? await (await fetch(f.url)).text() : f.text;
        pyodide.FS.writeFile("/home/pyodide/" + f.name, text);
      }
      postMessage({ id: m.id, ok: true });
    } else if (m.type === "run") {
      out = [];
      let error = null;
      try { await pyodide.runPythonAsync(m.code); } catch (err) { error = String(err.message || err); }
      postMessage({ id: m.id, ok: true, stdout: out.join("\\n"), error });
    } else if (m.type === "value") {
      const has = pyodide.runPython("'" + m.name + "' in globals()");
      postMessage({ id: m.id, ok: true, value: has ? String(pyodide.runPython("str(" + m.name + ")")) : null });
    }
  } catch (err) {
    postMessage({ id: m.id, ok: false, error: String(err.message || err) });
  }
};`;

export interface RunOutput {
  stdout: string;
  error: string | null;
}
export interface DatasetFile {
  name: string;
  text?: string;
  url?: string;
}

export class PythonRunner {
  private worker: Worker | null = null;
  private seq = 0;

  constructor(
    private readonly packages: string[],
    private readonly files: DatasetFile[],
    private readonly cellTimeoutMs: number
  ) {}

  private send<T>(message: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Python is not started."));
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // a cell that never returns is killed; the notebook must be started again (its variables are gone)
        this.stop();
        reject(new Error(`That took longer than ${Math.round(timeoutMs / 1000)}s and was stopped. Run all cells again to restart Python.`));
      }, timeoutMs);
      const onMessage = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        if (e.data.ok) resolve(e.data as T);
        else reject(new Error(e.data.error));
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage({ ...message, id });
    });
  }

  async start(): Promise<void> {
    this.stop();
    this.worker = new Worker(URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" })));
    // loading the runtime and packages is slow; give it far longer than a cell
    await this.send({ type: "init", indexURL: PYODIDE_INDEX_URL, packages: this.packages, files: this.files }, 180_000);
  }

  get isRunning(): boolean {
    return this.worker !== null;
  }

  run(code: string): Promise<RunOutput> {
    return this.send<RunOutput>({ type: "run", code }, this.cellTimeoutMs);
  }

  async value(name: string): Promise<string | null> {
    if (!NAME.test(name)) return null;
    return (await this.send<{ value: string | null }>({ type: "value", name }, 10_000)).value;
  }

  stop(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
