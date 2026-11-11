"use client";

import { PythonRunner } from "@/lib/arena-runtime/client/python-runner";
import type { RunnableLanguage } from "@/lib/practice/practice";
import { friendlyPythonError, pythonProgram } from "./playground";

export type RunResult = { ok: true; text: string; isError: boolean } | { ok: false; message: string };

// ---- Python: Pyodide in a Web Worker (lib/arena-runtime/client/python-runner). One runtime for the page, started the first time it is needed.
let python: PythonRunner | null = null;
let starting: Promise<void> | null = null;

export async function runPython(code: string, stdin: string, onStatus: (s: string) => void): Promise<RunResult> {
  try {
    python ??= new PythonRunner([], [], 20_000);
    if (!python.isRunning) {
      onStatus("Loading Python. The first run takes a few seconds, then it is instant.");
      starting ??= python.start().finally(() => { starting = null; });
      await starting;
    }
    onStatus("Running…");
    const out = await python.run(pythonProgram(code, stdin));
    return out.error ? { ok: true, text: [out.stdout, friendlyPythonError(out.error)].filter(Boolean).join("\n"), isError: true } : { ok: true, text: out.stdout || "(no output)", isError: false };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Python could not start. Check your connection and try again." };
  }
}

// ---- JavaScript: a Web Worker with console.log captured, so an endless loop can be stopped and the page cannot freeze.
const JS_WORKER = `self.onmessage = (e) => {
  const out = [];
  const show = (v) => { if (typeof v === 'string') return v; try { return JSON.stringify(v); } catch (_) { return String(v); } };
  const say = (prefix) => (...a) => out.push(prefix + a.map(show).join(' '));
  const c = { log: say(''), info: say(''), warn: say(''), error: say('Error: ') };
  const done = (error) => postMessage({ out: out.join('\\n'), error });
  try { new Function('console', e.data.code)(c); setTimeout(() => done(null), 100); }
  catch (err) { done(String((err && err.message) || err)); }
};`;

export function runJavaScript(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(URL.createObjectURL(new Blob([JS_WORKER], { type: "text/javascript" })));
    const timer = setTimeout(() => { worker.terminate(); resolve({ ok: false, message: "That took longer than 5 seconds and was stopped. Is there an endless loop?" }); }, 5000);
    const finish = (r: RunResult) => { clearTimeout(timer); worker.terminate(); resolve(r); };
    worker.onmessage = (e) => {
      const { out, error } = e.data as { out: string; error: string | null };
      finish(error ? { ok: true, text: [out, `Error: ${error}`].filter(Boolean).join("\n"), isError: true } : { ok: true, text: out || "(no output)", isError: false });
    };
    worker.onerror = (e) => finish({ ok: false, message: e.message || "Your code could not run." });
    worker.postMessage({ code });
  });
}

// ---- C, C++ and Java need a compiler, so they run on the server's code runner.
export async function runOnServer(language: RunnableLanguage, code: string, stdin: string): Promise<RunResult> {
  try {
    const res = await fetch("/api/code/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, code, stdin }) });
    const body = (await res.json().catch(() => ({}))) as { stdout?: string; stderr?: string; compileError?: string; error?: unknown };
    if (!res.ok) return { ok: false, message: res.status === 429 ? "You're running code too fast. Wait a few seconds." : typeof body.error === "string" ? body.error : "The code runner is busy. Try again in a moment." };
    if (body.compileError) return { ok: true, text: body.compileError, isError: true };
    return { ok: true, text: body.stdout || body.stderr || "(no output)", isError: !body.stdout && Boolean(body.stderr) };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection." };
  }
}
