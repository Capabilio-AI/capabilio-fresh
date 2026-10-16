"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Send } from "lucide-react";
import { PythonRunner } from "@/lib/arena-runtime/client/python-runner";
import { parsePythonResult, pythonHarness, runJavaScript, type CaseOutput } from "@/lib/arena-runtime/client/js-runner";
import { same } from "@/lib/workplace/code/compare";
import { EXAMPLE_COUNT, LANGUAGES, type CodeContent, type Lang } from "@/lib/workplace/code/problems";
import { useDraft, type ToolProps } from "./useDraft";

const LABEL: Record<Lang, string> = { python: "Python", javascript: "JavaScript" };
const show = (v: unknown) => JSON.stringify(v) ?? "null";

interface ExampleRow {
  args: unknown[];
  expected: unknown;
  out: CaseOutput;
}

/**
 * Write one function in Python or JavaScript. It runs in the browser on every case; what is submitted is what it returned (and the source,
 * for the explain-your-work interview). The server compares the results with its own answers.
 */
export function CodeTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<CodeContent>) {
  const [language, setLanguage] = useDraft<Lang>(attemptId, "language", "python");
  const [pyCode, setPyCode] = useDraft(attemptId, "code:python", content.starters.python);
  const [jsCode, setJsCode] = useDraft(attemptId, "code:javascript", content.starters.javascript);
  const [rows, setRows] = useState<ExampleRow[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "running">("idle");
  const [error, setError] = useState<string | null>(null);
  const python = useRef<PythonRunner | null>(null);

  useEffect(() => () => python.current?.stop(), []);

  const code = language === "python" ? pyCode : jsCode;
  const setCode = language === "python" ? setPyCode : setJsCode;
  const limitMs = content.timeLimitSeconds * 1000;

  async function runCases(cases: unknown[][]): Promise<CaseOutput[]> {
    if (language === "javascript") return runJavaScript(code, content.fn, cases, limitMs);
    if (!python.current?.isRunning) {
      setStatus("loading");
      const r = new PythonRunner([], [], limitMs);
      await r.start();
      python.current = r;
    }
    setStatus("running");
    const res = await python.current.run(`${code}\n${pythonHarness(content.fn, cases)}`);
    if (res.error) throw new Error(res.error.split("\n").slice(-3).join("\n"));
    const raw = await python.current.value("_result");
    if (!raw) throw new Error(`Define a function named ${content.fn}.`);
    return parsePythonResult(raw);
  }

  async function attempt(cases: unknown[][], done: (outs: CaseOutput[]) => void) {
    if (status !== "idle") return;
    setError(null);
    setStatus("running");
    try {
      done(await runCases(cases));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-app-border bg-white p-4">
        <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Examples</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {content.examples.map((ex, i) => (
            <li key={i} className="font-lp-mono text-[12.5px] text-app-charcoal">
              {content.fn}({ex.args.map(show).join(", ")}) <span className="text-app-muted">should give</span> {show(ex.expected)}
            </li>
          ))}
        </ul>
        <p className="mt-2 font-lp-body text-[12px] text-app-muted">Your function is also checked on more cases you are not shown the answers to. You have {content.maxSubmissions} tries.</p>
      </section>

      <div className="flex gap-2" role="tablist" aria-label="Language">
        {LANGUAGES.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={language === l} onClick={() => setLanguage(l)} className={`rounded-lg border px-3 py-1.5 font-lp-body text-[13px] font-semibold ${language === l ? "border-app-charcoal bg-app-charcoal text-white" : "border-app-border bg-white text-app-charcoal"}`}>{LABEL[l]}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]">
        <div className="border-b border-[#2a2a2a] px-4 py-2 font-lp-mono text-[11px] text-white/50">{language === "python" ? "solution.py" : "solution.js"}</div>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} wrap="off" aria-label={`${LABEL[language]} editor`} disabled={closed} className="block h-[300px] w-full resize-y overflow-auto bg-transparent px-4 py-3 font-lp-mono text-[13px] leading-[1.6] text-[#e8e8e8] caret-app-orange outline-none disabled:opacity-60" />
      </div>

      {!closed && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => attempt(content.cases.slice(0, EXAMPLE_COUNT), (outs) => setRows(outs.map((out, i) => ({ args: content.cases[i], expected: content.examples[i].expected, out }))))} className="flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />} {status === "loading" ? "Starting Python…" : "Run examples"}
          </button>
          <button type="button" disabled={busy || submitting} onClick={() => attempt(content.cases, (outputs) => onSubmit({ language, outputs, code }))} className="flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Submit
          </button>
          {status === "loading" && <span className="font-lp-body text-[12px] text-app-muted">The first Python start can take a few seconds.</span>}
        </div>
      )}
      {error && <p role="alert" className="whitespace-pre-wrap rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-mono text-[12.5px] text-app-rose">{error}</p>}
      {rows && (
        <section className="rounded-xl border border-app-border bg-white p-4">
          <h3 className="mb-2 font-lp-body text-[12px] font-semibold text-app-charcoal">Your results on the examples</h3>
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => {
              const passed = r.out.ok && same(r.out.value, r.expected);
              return (
                <li key={i} className="font-lp-mono text-[12.5px]">
                  <span className={passed ? "text-app-green" : "text-app-rose"}>{passed ? "✓" : "✗"}</span> {content.fn}({r.args.map(show).join(", ")}) → {r.out.ok ? show(r.out.value) : `error: ${r.out.error}`}
                  {!passed && <span className="text-app-muted"> (expected {show(r.expected)})</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
