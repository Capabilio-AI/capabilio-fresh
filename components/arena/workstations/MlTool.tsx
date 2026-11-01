"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FileText, Loader2, Play, Plus, RotateCcw, SkipForward, Trash2, Send } from "lucide-react";
import { PythonRunner } from "@/lib/arena-runtime/client/python-runner";
import type { MlContent } from "@/lib/workplace/ml/tickets";
import { useDraft, type ToolProps } from "./useDraft";

const PACKAGES = ["numpy", "pandas", "scikit-learn"];
const CELL_TIMEOUT_MS = 60_000;
const MAX_CELLS = 12;
const FIELD = "mt-1.5 w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13.5px] font-normal text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15";
const JUP = { "--jp-line": "#cfcfcf", "--jp-cell": "#f7f7f7", "--jp-in": "#303f9f", "--jp-out": "#d84315", "--jp-active": "#42a5f5", "--jp-ink": "#212121" } as React.CSSProperties;

type CellOutput = { n: number; text: string; failed: boolean };

/**
 * A notebook that runs Python in the browser, laid out like Jupyter: code cells with In [n] prompts, the output under each cell, Shift+Enter to run and move
 * on, and a kernel whose variables persist from cell to cell. Nothing here is graded as code: what is submitted is the `predictions` list or the numbers,
 * and the server checks them against answers it never sent to this page.
 */
export function MlTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<MlContent>) {
  const [cells, setCells] = useDraft<string[]>(attemptId, "cells", [content.starter]);
  const [answers, setAnswers] = useDraft<Record<string, string>>(attemptId, "answers", {});
  const [outputs, setOutputs] = useState<Record<number, CellOutput>>({});
  const [active, setActive] = useState(0);
  const [counter, setCounter] = useState(0);
  const [kernelUp, setKernelUp] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "running">("idle");
  const [error, setError] = useState<string | null>(null);
  const runner = useRef<PythonRunner | null>(null);
  const code = cells.join("\n\n");

  useEffect(() => () => runner.current?.stop(), []);

  async function ensureRunner(): Promise<PythonRunner> {
    if (runner.current?.isRunning) return runner.current;
    setStatus("loading");
    const r = new PythonRunner(PACKAGES, content.files, CELL_TIMEOUT_MS);
    await r.start();
    // library deprecation notices are noise for a fresher: they are not part of what the task is about
    await r.run("import warnings\nwarnings.filterwarnings(\"ignore\")");
    runner.current = r;
    setKernelUp(true);
    return r;
  }

  /** Runs one cell in the shared kernel. Returns false when the cell failed, so Run all can stop where Jupyter would. */
  async function runCell(i: number, n: number): Promise<boolean> {
    const r = await ensureRunner();
    setStatus("running");
    const res = await r.run(cells[i]);
    const text = [res.stdout, res.error].filter(Boolean).join("\n");
    setOutputs((o) => ({ ...o, [i]: { n, text: text || "", failed: Boolean(res.error) } }));
    return !res.error;
  }

  async function run(indices: number[]) {
    if (status !== "idle") return;
    setError(null);
    let n = counter;
    try {
      for (const i of indices) {
        n += 1;
        setCounter(n);
        if (!(await runCell(i, n))) break;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  function restart() {
    runner.current?.stop();
    runner.current = null;
    setKernelUp(false);
    setOutputs({});
    setCounter(0);
    setError(null);
    setStatus("idle");
  }

  function edit(i: number, value: string) {
    setCells(cells.map((c, j) => (j === i ? value : c)));
  }

  function onCellKey(e: KeyboardEvent<HTMLTextAreaElement>, i: number) {
    if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run([i]);
      if (e.shiftKey) setActive(Math.min(i + 1, cells.length - 1));
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = el;
      edit(i, cells[i].slice(0, s) + "    " + cells[i].slice(end));
      requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
    }
  }

  async function submitPredictions() {
    setError(null);
    try {
      const r = await ensureRunner();
      const res = await r.run(code);
      if (res.error) return setError(`Your code stopped with an error, fix it first:\n${res.error}`);
      const exported = await r.run("import json as _json\n_submission = _json.dumps([int(x) for x in predictions])");
      if (exported.error) return setError("Could not read `predictions`. Set it to a list of 0 and 1, one per row of test.csv.");
      const raw = await r.value("_submission");
      onSubmit({ predictions: raw ? (JSON.parse(raw) as number[]) : [], code });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";
  const complete = content.fields.every((f) => (answers[f.key] ?? "").trim() !== "");
  const kernel = status === "loading" ? "Starting Python…" : status === "running" ? "Busy" : kernelUp ? "Idle" : "Not started";

  return (
    <div className="flex flex-col gap-4">
      <div style={JUP} className="overflow-hidden rounded-lg border border-[var(--jp-line)] bg-white text-[var(--jp-ink)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--jp-line)] bg-[#fafafa] px-3 py-1.5">
          <span className="text-[13px] font-semibold">notebook.ipynb</span>
          {!closed && (
            <div className="ml-3 flex items-center gap-1" role="toolbar" aria-label="Notebook actions">
              <button type="button" title="Add a code cell below" disabled={cells.length >= MAX_CELLS} onClick={() => { setCells([...cells.slice(0, active + 1), "", ...cells.slice(active + 1)]); setActive(active + 1); }} className="flex items-center gap-1 rounded-sm border border-[var(--jp-line)] bg-white px-2 py-1 text-[12px] hover:bg-[#f0f0f0] disabled:opacity-40"><Plus size={13} aria-hidden /> Cell</button>
              <button type="button" title="Run this cell (Shift+Enter)" disabled={busy} onClick={() => run([active])} className="flex items-center gap-1 rounded-sm border border-[var(--jp-line)] bg-white px-2 py-1 text-[12px] hover:bg-[#f0f0f0] disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Play size={13} aria-hidden />} Run</button>
              <button type="button" title="Run every cell from the top" disabled={busy} onClick={() => run(cells.map((_, i) => i))} className="flex items-center gap-1 rounded-sm border border-[var(--jp-line)] bg-white px-2 py-1 text-[12px] hover:bg-[#f0f0f0] disabled:opacity-40"><SkipForward size={13} aria-hidden /> Run all</button>
              <button type="button" title="Restart the kernel: variables are cleared" onClick={restart} className="flex items-center gap-1 rounded-sm border border-[var(--jp-line)] bg-white px-2 py-1 text-[12px] hover:bg-[#f0f0f0]"><RotateCcw size={13} aria-hidden /> Restart</button>
            </div>
          )}
          <span className="ml-auto flex items-center gap-2 text-[11.5px] text-[#616161]">
            <span className={`h-2 w-2 rounded-full ${status === "idle" ? (kernelUp ? "bg-[#43a047]" : "bg-[#bdbdbd]") : "bg-[#fb8c00]"}`} aria-hidden />
            Python 3 (Pyodide) · {kernel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--jp-line)] px-3 py-1.5">
          {content.files.map((f) => (
            <span key={f.name} className="flex items-center gap-1.5 rounded-sm border border-[var(--jp-line)] bg-[#fafafa] px-2 py-0.5 font-lp-mono text-[11.5px]" title={`${f.text.split("\n").length - 1} rows`}>
              <FileText size={12} aria-hidden /> {f.name}
            </span>
          ))}
          <span className="text-[11.5px] text-[#616161]">Files sit next to the notebook, so pd.read_csv(&quot;name.csv&quot;) works. {content.maxSubmissions} tries.</span>
        </div>

        <ol className="flex flex-col gap-3 px-3 py-4">
          {cells.map((src, i) => {
            const out = outputs[i];
            return (
              <li key={i} className="flex gap-2" onFocusCapture={() => setActive(i)}>
                <span className="w-[62px] shrink-0 pt-2 text-right font-lp-mono text-[11.5px] text-[var(--jp-in)]" aria-hidden>
                  In&nbsp;[{out && out.n ? out.n : " "}]:
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`flex rounded-sm border bg-[var(--jp-cell)] ${active === i ? "border-[var(--jp-active)] shadow-[inset_3px_0_0_var(--jp-active)]" : "border-[var(--jp-line)]"}`}>
                    <textarea
                      value={src}
                      onChange={(e) => edit(i, e.target.value)}
                      onKeyDown={(e) => onCellKey(e, i)}
                      rows={Math.min(18, Math.max(3, src.split("\n").length + 1))}
                      spellCheck={false}
                      wrap="off"
                      aria-label={`Code cell ${i + 1}`}
                      disabled={closed}
                      className="block w-full resize-y overflow-auto bg-transparent px-3 py-2 font-lp-mono text-[13px] leading-[1.55] outline-none [font-variant-ligatures:none] disabled:opacity-60"
                    />
                    {!closed && cells.length > 1 && (
                      <button type="button" aria-label={`Delete cell ${i + 1}`} onClick={() => { setCells(cells.filter((_, j) => j !== i)); setOutputs({}); setActive(Math.max(0, i - 1)); }} className="self-start p-2 text-[#9e9e9e] hover:text-[var(--jp-out)]">
                        <Trash2 size={13} aria-hidden />
                      </button>
                    )}
                  </div>
                  {out && out.text !== "" && (
                    <div className="mt-1 flex gap-2">
                      <pre className={`max-h-[260px] min-w-0 flex-1 overflow-auto whitespace-pre-wrap px-3 py-1.5 font-lp-mono text-[12.5px] ${out.failed ? "bg-[#fdecea] text-[#b71c1c]" : ""}`}>{out.text}</pre>
                    </div>
                  )}
                  {out && out.text === "" && <p className="mt-1 px-3 font-lp-mono text-[11.5px] text-[#9e9e9e]">(no output)</p>}
                </div>
              </li>
            );
          })}
        </ol>
        {status === "loading" && <p className="border-t border-[var(--jp-line)] px-3 py-1.5 text-[12px] text-[#616161]">The first start downloads Python and its libraries, which can take a minute.</p>}
      </div>
      {error && <p role="alert" className="whitespace-pre-wrap rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}

      <section aria-labelledby="ml-submit-h" className="rounded-xl border border-app-border bg-white p-5">
        <h3 id="ml-submit-h" className="font-lp-display text-[18px] font-bold text-app-charcoal">{content.kind === "predict" ? "Your predictions" : "Your numbers"}</h3>
        {content.kind === "predict" ? (
          <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">Set <code className="font-lp-mono">predictions</code> to a list of 0 and 1, one per row of test.csv, in the same order. Submitting runs your notebook first and reads that list.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {content.fields.map((f) => (
              <label key={f.key} className="block font-lp-body text-[13px] font-semibold text-app-charcoal">
                {f.label}
                {f.help && <span className="mt-0.5 block text-[12px] font-normal text-app-muted">{f.help}</span>}
                <input value={answers[f.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} disabled={closed} inputMode="decimal" maxLength={40} className={FIELD} />
              </label>
            ))}
          </div>
        )}
        {!closed && (
          <button type="button" onClick={() => (content.kind === "predict" ? submitPredictions() : onSubmit({ answers, code }))} disabled={submitting || busy || (content.kind === "numbers" && !complete)} className="mt-4 flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Submit
          </button>
        )}
      </section>
    </div>
  );
}
