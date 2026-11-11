"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Play, RotateCcw } from "lucide-react";
import { PREVIEW_SANDBOX_CSP, buildPreviewDoc, canRunInBrowser, type PlaygroundLanguage } from "@/lib/playground/playground";
import { runJavaScript, runOnServer, runPython, type RunResult } from "@/lib/playground/run-client";
import type { RunnableLanguage } from "@/lib/practice/practice";
import { CodeEditor } from "./CodeEditor";

const LABEL: Record<PlaygroundLanguage, string> = { python: "Python", java: "Java", c: "C", cpp: "C++", javascript: "JavaScript", typescript: "TypeScript", html: "HTML", css: "CSS", sql: "SQL" };
const asksForInput = (language: PlaygroundLanguage, code: string) => (language === "python" ? /\binput\s*\(/.test(code) : language === "c" ? /\bscanf\s*\(|\bgets\s*\(|\bfgets\s*\(/.test(code) : language === "cpp" ? /\bcin\s*>>|\bgetline\s*\(/.test(code) : language === "java" ? /\bScanner\b|\bBufferedReader\b/.test(code) : false);

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => undefined); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)]">
      {done ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{done ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * "Try it Yourself": the example's code on the left, its result on the right, one Run button. Python, JavaScript, HTML and CSS run in the
 * student's own browser, so they are instant; C, C++ and Java run on the server's code runner. SQL examples are shown with a Copy button.
 */
export function Playground({ code: original, language, title }: { code: string; language: PlaygroundLanguage; title: string }) {
  const [code, setCode] = useState(original);
  const [stdin, setStdin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  // HTML and CSS show their result straight away, the way a page would
  const [page, setPage] = useState<string | null>(() => (language === "html" || language === "css" ? buildPreviewDoc(language, original) : null));
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  if (language === "sql") {
    return (
      <div className="mx-4 mt-2 overflow-hidden rounded-lg bg-[var(--m-ink)]">
        <div className="flex items-center justify-between bg-black/25 px-3 py-1.5"><span className="text-[12px] font-bold uppercase tracking-wide text-white/60">SQL example</span><CopyButton text={original} /></div>
        <pre className="ss-scroll overflow-x-auto p-4 font-lp-mono text-[13px] leading-relaxed text-white"><code>{original}</code></pre>
      </div>
    );
  }

  async function run() {
    setBusy("Running…");
    setResult(null);
    let r: RunResult;
    if (language === "html" || language === "css") { setPage(buildPreviewDoc(language, code)); setBusy(null); return; }
    if (language === "python") r = await runPython(code, stdin, (s) => live.current && setBusy(s));
    else if (language === "javascript") r = await runJavaScript(code);
    else r = await runOnServer(language as RunnableLanguage, code, stdin);
    if (!live.current) return;
    setBusy(null);
    setResult(r);
  }

  const web = language === "html" || language === "css";
  return (
    <div className="mx-4 mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--m-ink)] px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-white">{LABEL[language]}</span>
        <button type="button" onClick={() => void run()} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-full bg-[#17784a] px-4 py-1.5 text-[13.5px] font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <Play size={14} aria-hidden />}{busy ? "Working…" : web ? "Update result" : "Run"}
        </button>
        <button type="button" onClick={() => { setCode(original); setResult(null); if (web) setPage(buildPreviewDoc(language as "html" | "css", original)); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)]"><RotateCcw size={13} aria-hidden />Reset</button>
        <span className="ml-auto hidden text-[12px] text-[var(--m-muted)] sm:inline">{canRunInBrowser(language) ? "Runs in your browser" : "Runs on our server"} · Ctrl/⌘ + Enter</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <CodeEditor value={code} onChange={setCode} onRun={() => void run()} label={`Code for ${title}`} />
        <div className="flex min-h-[200px] flex-col overflow-hidden rounded-lg border border-[var(--m-rule)] bg-white">
          <p className="border-b border-[var(--m-rule)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Result</p>
          {web && page !== null ? (
            // the page runs in its own sandbox: it can run script but cannot reach this site, its cookies or the network
            <iframe title={`Result of ${title}`} sandbox="allow-scripts" srcDoc={page} className="min-h-[200px] w-full flex-1 bg-white" data-csp={PREVIEW_SANDBOX_CSP} />
          ) : busy ? (
            <p role="status" className="flex items-center gap-2 p-3 text-[13.5px] text-[var(--m-muted)]"><Loader2 size={14} aria-hidden className="animate-spin" />{busy}</p>
          ) : result ? (
            result.ok
              ? <pre role="status" className={`ss-scroll m-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-lp-mono text-[13px] ${result.isError ? "bg-red-50 text-red-800" : "text-[var(--m-ink)]"}`}>{result.text}</pre>
              : <p role="alert" className="m-0 flex-1 bg-red-50 p-3 text-[13.5px] font-semibold text-red-800">{result.message}</p>
          ) : (
            <p className="p-3 text-[13.5px] text-[var(--m-muted)]">Press Run to see what your code does. Edit it first if you like.</p>
          )}
        </div>
      </div>
      {!web && asksForInput(language, code) && (
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-[var(--m-muted)]">
          This program reads input. Type it here, one line per input:
          <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--m-rule)] bg-white p-2 font-lp-mono text-[13px] font-normal text-[var(--m-ink)]" />
        </label>
      )}
    </div>
  );
}
