"use client";

import { useState } from "react";
import { CircleCheck, Loader2, Play, XCircle } from "lucide-react";
import { runJavaScript, runOnServer, runPython, type RunResult } from "@/lib/playground/run-client";
import type { RunnableLanguage } from "@/lib/practice/practice";
import { sameOutput } from "@/lib/languages/guess";

type Verdict = { guess: string; output: string; right: boolean; isError: boolean };

/**
 * Guess before you run. Reading code and predicting what it does is the skill; pressing Run only to see is not. The student writes what they think the
 * program prints, and then the real program is run and compared.
 */
export function GuessBox({ code, language, title, onChange }: { code: string; language: string; title: string; onChange: () => void }) {
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function check() {
    setBusy(true); setProblem(null); setVerdict(null);
    let r: RunResult;
    if (language === "python") r = await runPython(code, "", () => undefined);
    else if (language === "javascript") r = await runJavaScript(code);
    else r = await runOnServer(language as RunnableLanguage, code, "");
    setBusy(false);
    if (!r.ok) { setProblem(r.message); return; }
    setVerdict({ guess, output: r.text, right: !r.isError && sameOutput(guess, r.text), isError: r.isError });
  }

  return (
    <div className="mx-4 mt-2 flex flex-col gap-3">
      <p className="text-[14.5px] text-[var(--m-ink)]">Read the code. <strong>What will it print?</strong> Write your guess, then press Check.</p>
      <pre className="ss-scroll overflow-x-auto rounded-lg bg-[var(--m-ink)] p-4 font-lp-mono text-[13px] leading-relaxed text-white" aria-label={`Code for ${title}`}><code>{code}</code></pre>
      <label className="flex flex-col gap-1.5 text-[13.5px] font-bold text-[var(--m-ink)]">My guess
        <textarea value={guess} onChange={(e) => { setGuess(e.target.value); setVerdict(null); }} rows={3} spellCheck={false} placeholder="Write what you think it prints"
          className="rounded-lg border border-[var(--m-rule)] bg-white p-3 font-lp-mono text-[13.5px] font-normal text-[var(--m-ink)]" />
      </label>
      <div>
        <button type="button" onClick={() => void check()} disabled={busy || guess.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-full bg-[#17784a] px-4 py-1.5 text-[13.5px] font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <Play size={14} aria-hidden />}{busy ? "Running…" : "Check my guess"}
        </button>
      </div>
      {problem && <p role="alert" className="text-[13.5px] font-semibold text-red-700">{problem}</p>}
      {verdict && (
        <div role="status" className={verdict.right ? "rounded-xl bg-[#e8f5ee] p-4 text-[#0f5132]" : "rounded-xl bg-red-50 p-4 text-red-900"}>
          <p className="flex items-center gap-2 text-[15px] font-bold">{verdict.right ? <CircleCheck size={17} aria-hidden /> : <XCircle size={17} aria-hidden />}{verdict.right ? "Yes, you are right!" : verdict.isError ? "The program stopped with an error." : "Not this time."}</p>
          <p className="mt-2 text-[12.5px] font-bold uppercase tracking-wide opacity-70">The program printed</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-lp-mono text-[13px]">{verdict.output || "(nothing)"}</pre>
          {!verdict.right && <><p className="mt-2 text-[12.5px] font-bold uppercase tracking-wide opacity-70">Your guess</p><pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-lp-mono text-[13px]">{verdict.guess}</pre><p className="mt-2 text-[13.5px]">Read the code again, one line at a time. The explanation on the left shows what happens.</p></>}
          <button type="button" onClick={onChange} className="mt-3 text-[13.5px] font-bold underline">Now change the code and run it</button>
        </div>
      )}
    </div>
  );
}
