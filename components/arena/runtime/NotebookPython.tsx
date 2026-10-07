"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, PlayCircle } from "lucide-react";
import { PythonRunner, type DatasetFile } from "@/lib/arena-runtime/client/python-runner";
import { asRecord, checksOf, text, type RuntimeProps } from "./types";

const DEFAULT_CELL_SECONDS = 30;

interface CellOutput {
  stdout: string;
  error: string | null;
}

/**
 * Python notebook on Pyodide in a Web Worker (a stuck cell is terminated, never freezing the page). Datasets in assets.files / assets.fileUrls
 * are mounted in the notebook's working directory. Each check that names a `variable` (config.public.variable) is filled from that variable after
 * a run; the server compares it to the hidden expected value.
 */
export function NotebookPython({ view, draft, onDraft, disabled }: RuntimeProps) {
  const starterCells = Array.isArray(view.assets?.cells) ? (view.assets.cells as string[]) : [""];
  const cells = Array.isArray(draft.cells) ? (draft.cells as string[]) : starterCells;
  const answers = asRecord<string>(draft.answers);
  const targets = checksOf(view, "NUMERIC_ANSWER", "OUTPUT_MATCH").filter((c) => text(c.public?.variable));
  const runner = useRef<PythonRunner | null>(null);
  const draftRef = useRef(draft);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<number, CellOutput>>({});
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const limits = view.workstation?.limits;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    const config = view.workstation?.config ?? {};
    const files: DatasetFile[] = [
      ...Object.entries(asRecord<string>(view.assets?.files)).map(([name, t]) => ({ name, text: t })),
      ...(Array.isArray(view.assets?.fileUrls) ? (view.assets.fileUrls as { name: string; url: string }[]) : []),
    ];
    const r = new PythonRunner((config.packages as string[] | undefined) ?? [], files, (limits?.wallTimeSeconds ? Math.min(limits.wallTimeSeconds, DEFAULT_CELL_SECONDS) : DEFAULT_CELL_SECONDS) * 1000);
    runner.current = r;
    r.start()
      .then(() => !cancelled && setState("ready"))
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setState("error");
      });
    return () => {
      cancelled = true;
      r.stop();
    };
  }, [view.assets, view.workstation, limits?.wallTimeSeconds, attempt]);

  const setCell = (i: number, code: string) => onDraft({ ...draft, cells: cells.map((c, j) => (j === i ? code : c)) });

  async function harvest(r: PythonRunner) {
    const found: Record<string, string> = {};
    for (const t of targets) {
      const v = await r.value(text(t.public?.variable));
      if (v !== null) found[t.id] = v;
    }
    onDraft({ ...draftRef.current, answers: { ...asRecord<string>(draftRef.current.answers), ...found } });
  }

  async function runCells(indices: number[]) {
    const r = runner.current;
    if (!r || busy) return;
    setBusy(true);
    try {
      if (!r.isRunning) {
        await r.start();
        setState("ready");
      }
      for (const i of indices) {
        const out = await r.run(cells[i] ?? "");
        setOutputs((o) => ({ ...o, [i]: out }));
        if (out.error) break;
      }
      await harvest(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading")
    return (
      <p className="flex items-center gap-2 font-lp-body text-[13px] text-app-muted">
        <Loader2 size={15} className="animate-spin" /> Preparing your notebook (the first load can take a minute)…
      </p>
    );
  if (state === "error")
    return (
      <div className="rounded-lg border border-app-border bg-white p-4 font-lp-body text-[13px]">
        <p className="text-app-rose">The notebook could not start{error ? `: ${error}` : "."}</p>
        <button type="button" onClick={() => { setError(null); setState("loading"); setAttempt((n) => n + 1); }} className="mt-2 font-semibold text-app-blue hover:underline">Try again</button>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-lp-body text-[12px] text-app-muted">{text(view.workstation?.config.evaluationHarness) || "Run your cells; the values below are what gets checked."}</p>
        <button type="button" onClick={() => runCells(cells.map((_, i) => i))} disabled={disabled || busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-app-charcoal px-3.5 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-50">
          <PlayCircle size={13} /> Run all
        </button>
      </div>

      {cells.map((code, i) => (
        <section key={i} aria-label={`Cell ${i + 1}`} className="rounded-lg border border-app-border bg-white">
          <textarea value={code} onChange={(e) => setCell(i, e.target.value)} spellCheck={false} rows={Math.min(14, Math.max(4, code.split("\n").length + 1))} disabled={disabled} className="w-full rounded-t-lg bg-transparent p-3 font-lp-mono text-[12.5px] leading-relaxed" />
          <div className="flex items-center gap-2 border-t border-app-border px-3 py-1.5">
            <button type="button" onClick={() => runCells([i])} disabled={disabled || busy} className="inline-flex items-center gap-1 font-lp-body text-[12px] font-semibold text-app-blue disabled:opacity-50"><Play size={11} /> Run cell</button>
          </div>
          {outputs[i] && (outputs[i].stdout || outputs[i].error) && (
            <pre aria-live="polite" className={`overflow-x-auto border-t border-app-border px-3 py-2 font-lp-mono text-[12px] ${outputs[i].error ? "text-app-rose" : "text-app-charcoal"}`}>{outputs[i].error ?? outputs[i].stdout}</pre>
          )}
        </section>
      ))}

      {targets.length > 0 && (
        <section aria-label="Checked values" className="rounded-lg border border-app-border bg-white p-3">
          <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Values that will be checked</h3>
          <ul className="mt-1.5 flex flex-col gap-1">
            {targets.map((t) => (
              <li key={t.id} className="font-lp-mono text-[12px] text-app-charcoal">
                {text(t.public?.variable)} = <span className={answers[t.id] === undefined ? "text-app-muted" : ""}>{answers[t.id] ?? "(not set — run your cells)"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
