"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Play, Send } from "lucide-react";
import { PythonRunner } from "@/lib/arena-runtime/client/python-runner";
import type { MlContent } from "@/lib/workplace/ml/tickets";
import { useDraft, type ToolProps } from "./useDraft";

const PACKAGES = ["numpy", "pandas", "scikit-learn"];
const CELL_TIMEOUT_MS = 60_000;
const FIELD = "mt-1.5 w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13.5px] font-normal text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15";

/**
 * A notebook that runs Python in the browser. Nothing here is graded as code: what is submitted is the `predictions` list or the numbers,
 * and the server checks them against answers it never sent to this page.
 */
export function MlTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<MlContent>) {
  const [code, setCode] = useDraft(attemptId, "code", content.starter);
  const [answers, setAnswers] = useDraft<Record<string, string>>(attemptId, "answers", {});
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "running">("idle");
  const [error, setError] = useState<string | null>(null);
  const runner = useRef<PythonRunner | null>(null);

  useEffect(() => () => runner.current?.stop(), []);

  async function ensureRunner(): Promise<PythonRunner> {
    if (runner.current?.isRunning) return runner.current;
    setStatus("loading");
    const r = new PythonRunner(PACKAGES, content.files, CELL_TIMEOUT_MS);
    await r.start();
    runner.current = r;
    return r;
  }

  async function run(source = code) {
    if (status !== "idle") return;
    setError(null);
    try {
      const r = await ensureRunner();
      setStatus("running");
      const res = await r.run(source);
      setOutput([res.stdout, res.error].filter(Boolean).join("\n") || "(no output)");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {content.files.map((f) => (
          <span key={f.name} className="flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-2.5 py-1 font-lp-mono text-[12px] text-app-charcoal" title={`${f.text.split("\n").length - 1} rows`}>
            <FileText size={12} aria-hidden /> {f.name}
          </span>
        ))}
        <span className="font-lp-body text-[12px] text-app-muted">Files are ready to read in your notebook. You have {content.maxSubmissions} tries.</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2 font-lp-mono text-[11px] text-white/50"><span>notebook.py</span><span className="hidden sm:block">Python runs in your browser</span></div>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} wrap="off" aria-label="Python editor" disabled={closed} className="block h-[320px] w-full resize-y overflow-auto bg-transparent px-4 py-3 font-lp-mono text-[13px] leading-[1.6] text-[#e8e8e8] caret-app-orange outline-none disabled:opacity-60" />
      </div>

      {!closed && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => run()} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />} {status === "loading" ? "Starting Python…" : "Run"}
          </button>
          {status === "loading" && <span className="font-lp-body text-[12px] text-app-muted">The first start downloads Python and its libraries, which can take a minute.</span>}
        </div>
      )}
      {error && <p role="alert" className="whitespace-pre-wrap rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}
      <section className="rounded-xl border border-app-border bg-white p-4">
        <h3 className="mb-2 font-lp-body text-[12px] font-semibold text-app-charcoal">Output</h3>
        <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap font-lp-mono text-[12.5px] text-app-charcoal">{output || "Run your code to see its output."}</pre>
      </section>

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
