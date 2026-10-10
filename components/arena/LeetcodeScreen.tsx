"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, Maximize2, Play, Send, XCircle } from "lucide-react";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";
import type { PublicProblem } from "@/lib/arena-challenges/leetcode/problem";
import { Countdown } from "./workstations/Countdown";
import type { ChallengeDetail } from "./ChallengeSolvePanel";

// Full-screen, LeetCode-style workspace: problem on the left, editor and test console on the right.
// Colours are explicit hex on purpose: this screen is dark whatever the surrounding page theme is.
const C = { bg: "#0f1115", panel: "#171a21", line: "#262b36", text: "#e8eaed", soft: "#9aa3b2", accent: "#ff7a45", ok: "#22c58b", bad: "#ff5a76" };
const LANGS = [{ id: "python", label: "Python 3" }, { id: "c", label: "C" }] as const;
type Lang = (typeof LANGS)[number]["id"];
const DIFF_COLOR: Record<string, string> = { easy: "#22c58b", medium: "#ffc83d", hard: "#ff5a76" };

interface RunResult { index: number; passed: boolean; input: string; expected: string; actual: string; error: string }
interface TestRow { index: number; passed: boolean; hidden: boolean; input?: string; expected?: string; actual?: string; error?: string }
type Console = { kind: "run"; results: RunResult[] } | { kind: "custom"; output: string; error: string } | { kind: "submit"; accepted: boolean; points: number; tests: TestRow[] };

const draftKey = (id: string, lang: Lang) => `capabilio:lc:${id}:${lang}`;
const readDraft = (id: string, lang: Lang): string | null => { try { return localStorage.getItem(draftKey(id, lang)); } catch { return null; } };

export function LeetcodeScreen({ challenge, problem, onDone }: { challenge: ChallengeDetail; problem: PublicProblem; onDone: () => void }) {
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState(problem.starters.python);
  const [pane, setPane] = useState<"problem" | "code">("problem");
  const [customInput, setCustomInput] = useState(problem.examples[0]?.input ?? "");
  const [consoleTab, setConsoleTab] = useState<"cases" | "custom" | "result">("cases");
  const [out, setOut] = useState<Console | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(challenge.solved === true);
  const [expiresAt] = useState(() => new Date(Date.now() + challenge.time_limit_minutes * 60_000).toISOString());
  const [overTime, setOverTime] = useState(false);
  const gutter = useRef<HTMLPreElement>(null);
  const noop = useCallback(() => setOverTime(true), []);

  // restore a saved draft after mount (localStorage is browser-only)
  useEffect(() => {
    queueMicrotask(() => setCode(readDraft(challenge.id, lang) ?? (lang === "python" ? problem.starters.python : problem.starters.c)));
  }, [challenge.id, lang, problem.starters]);

  function edit(next: string) {
    setCode(next);
    try { localStorage.setItem(draftKey(challenge.id, lang), next); } catch { /* drafts are a convenience */ }
  }

  async function call(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
    return data;
  }

  async function run(custom: boolean) {
    setBusy("run"); setError(null); setPane("code");
    try {
      const data = await call("/api/arena/challenges/run", { challengeId: challenge.id, language: lang, code, ...(custom ? { customInput } : {}) });
      setOut(custom ? { kind: "custom", output: data.custom.output, error: data.custom.error } : { kind: "run", results: data.results });
      setConsoleTab(custom ? "custom" : "result");
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function submit() {
    setBusy("submit"); setError(null); setPane("code");
    try {
      const data = await call("/api/arena/challenges/submit", { challengeId: challenge.id, language: lang, code });
      setOut({ kind: "submit", accepted: data.isCorrect, points: data.pointsEarned, tests: data.tests ?? [] });
      setConsoleTab("result");
      if (data.isCorrect) setLocked(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  const lines = code.split("\n").length;
  const disabled = busy !== null || locked;
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-bold disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: C.bg, color: C.text }}>
      <header className="flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
        <button type="button" onClick={onDone} className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: C.soft }}><ArrowLeft size={15} /> Challenges</button>
        <span className="text-[14px] font-extrabold">{challenge.title}</span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" style={{ color: DIFF_COLOR[challenge.difficulty], border: `1px solid ${DIFF_COLOR[challenge.difficulty]}66` }}>{challenge.difficulty}</span>
        <span className="font-mono text-[12.5px] font-semibold" style={{ color: overTime ? C.bad : C.soft }}>
          {overTime ? "Over time" : <Countdown target={expiresAt} onDone={noop} />}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} disabled={disabled} aria-label="Language" className="rounded-lg px-2.5 py-1.5 text-[13px]" style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}` }}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button type="button" disabled={disabled} onClick={() => run(false)} className={btn} style={{ background: C.line, color: C.text }}><Play size={14} /> {busy === "run" ? "Running…" : "Run"}</button>
          <button type="button" disabled={disabled} onClick={submit} className={btn} style={{ background: C.accent, color: "#fff" }}><Send size={14} /> {busy === "submit" ? "Judging…" : "Submit"}</button>
          <button type="button" aria-label="Browser full screen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }} className="hidden rounded-lg p-2 sm:block" style={{ color: C.soft }}><Maximize2 size={15} /></button>
        </div>
      </header>

      <div className="flex border-b lg:hidden" style={{ borderColor: C.line }}>
        {(["problem", "code"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPane(p)} className="flex-1 py-2 text-[13px] font-bold capitalize" style={{ color: pane === p ? C.accent : C.soft, borderBottom: pane === p ? `2px solid ${C.accent}` : "2px solid transparent" }}>{p}</button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section className={`${pane === "problem" ? "block" : "hidden"} min-h-0 overflow-y-auto p-5 lg:block`} style={{ borderRight: `1px solid ${C.line}` }}>
          <h1 className="text-[20px] font-extrabold">{challenge.title}</h1>
          <p className="mt-0.5 text-[12px]" style={{ color: C.soft }}>{challenge.category} · +{pointsForDifficulty(challenge.difficulty)} pts</p>
          <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed">{problem.statement}</p>
          <Block title="Input">{problem.inputFormat}</Block>
          <Block title="Output">{problem.outputFormat}</Block>
          <Block title="Constraints"><ul className="list-disc pl-5">{problem.constraints.map((c) => <li key={c} className="font-mono text-[13px]">{c}</li>)}</ul></Block>
          {problem.examples.map((ex, i) => (
            <div key={i} className="mt-5 rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.soft }}>Example {i + 1}</p>
              <Pair label="Input" value={ex.input} /><Pair label="Output" value={ex.output} />
              <p className="mt-2 text-[13px]" style={{ color: C.soft }}>{ex.explanation}</p>
            </div>
          ))}
        </section>

        <section className={`${pane === "code" ? "flex" : "hidden"} min-h-0 flex-col lg:flex`}>
          {locked && (
            <div className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold" style={{ background: "#12301f", color: C.ok }}><Lock size={14} /> Completed. This challenge is locked and can no longer be edited.</div>
          )}
          <div className="relative flex min-h-0 flex-[3] font-mono text-[13.5px] leading-[1.6]">
            <pre ref={gutter} aria-hidden className="m-0 select-none overflow-hidden px-3 py-3 text-right" style={{ color: "#566074", background: C.panel, minWidth: 44 }}>{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</pre>
            <textarea value={code} readOnly={locked} spellCheck={false} aria-label="Code editor"
              onChange={(e) => edit(e.target.value)}
              onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
              onKeyDown={(e) => {
                if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget, s = t.selectionStart; edit(code.slice(0, s) + "    " + code.slice(t.selectionEnd)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4; }); }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !disabled) { e.preventDefault(); void run(false); }
              }}
              className="min-h-0 flex-1 resize-none whitespace-pre px-3 py-3 outline-none" style={{ background: C.bg, color: C.text, tabSize: 4, overflow: "auto" }} />
          </div>

          <div className="flex min-h-0 flex-[2] flex-col" style={{ borderTop: `1px solid ${C.line}`, background: C.panel }}>
            <div className="flex gap-1 px-3 pt-2">
              {([["cases", "Testcases"], ["custom", "Custom input"], ["result", "Result"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setConsoleTab(id)} className="rounded-md px-3 py-1 text-[12.5px] font-bold" style={{ background: consoleTab === id ? C.line : "transparent", color: consoleTab === id ? C.text : C.soft }}>{label}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-[13px]">
              {error && <p role="alert" style={{ color: C.bad }}>{error}</p>}
              {consoleTab === "cases" && problem.examples.map((ex, i) => <div key={i} className="mb-3"><p className="mb-1 text-[12px] font-bold" style={{ color: C.soft }}>Case {i + 1}</p><Pair label="Input" value={ex.input} /><Pair label="Expected" value={ex.output} /></div>)}
              {consoleTab === "custom" && (
                <div>
                  <textarea value={customInput} onChange={(e) => setCustomInput(e.target.value)} rows={4} spellCheck={false} aria-label="Custom input" className="w-full rounded-lg p-2 font-mono text-[13px] outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}` }} />
                  <button type="button" disabled={disabled} onClick={() => run(true)} className={`${btn} mt-2`} style={{ background: C.line, color: C.text }}><Play size={13} /> Run this input</button>
                  {out?.kind === "custom" && <div className="mt-3"><Pair label="Output" value={out.output || "(no output)"} />{out.error && <pre className="mt-2 whitespace-pre-wrap font-mono text-[12.5px]" style={{ color: C.bad }}>{out.error}</pre>}</div>}
                </div>
              )}
              {consoleTab === "result" && !out && <p style={{ color: C.soft }}>Run your code on the examples, or Submit to judge it on every test.</p>}
              {consoleTab === "result" && out?.kind === "run" && out.results.map((r) => (
                <div key={r.index} className="mb-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: r.passed ? C.ok : C.bad }}>{r.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />} Case {r.index + 1} {r.passed ? "passed" : "failed"}</p>
                  <Pair label="Input" value={r.input} /><Pair label="Expected" value={r.expected} /><Pair label="Your output" value={r.actual || "(no output)"} />
                  {r.error && <pre className="mt-1 whitespace-pre-wrap font-mono text-[12.5px]" style={{ color: C.bad }}>{r.error}</pre>}
                </div>
              ))}
              {consoleTab === "result" && out?.kind === "submit" && <SubmitResult out={out} />}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SubmitResult({ out }: { out: Extract<Console, { kind: "submit" }> }) {
  const passed = out.tests.filter((t) => t.passed).length;
  return (
    <div>
      <p className="flex items-center gap-2 text-[16px] font-extrabold" style={{ color: out.accepted ? C.ok : C.bad }}>
        {out.accepted ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{out.accepted ? `Accepted · +${out.points} pts` : "Wrong answer"}
        <span className="text-[12.5px] font-semibold" style={{ color: C.soft }}>{passed}/{out.tests.length} tests passed</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {out.tests.map((t) => <span key={t.index} className="rounded-md px-2 py-0.5 text-[11.5px] font-bold" style={{ background: t.passed ? "#12301f" : "#3a1520", color: t.passed ? C.ok : C.bad }}>{t.hidden ? "Hidden" : "Example"} {t.index + 1}</span>)}
      </div>
      {out.tests.filter((t) => !t.passed && !t.hidden).map((t) => (
        <div key={t.index} className="mt-3"><Pair label="Input" value={t.input ?? ""} /><Pair label="Expected" value={t.expected ?? ""} /><Pair label="Your output" value={t.actual || "(no output)"} />{t.error && <pre className="mt-1 whitespace-pre-wrap font-mono text-[12.5px]" style={{ color: C.bad }}>{t.error}</pre>}</div>
      ))}
      {!out.accepted && <p className="mt-3 text-[12.5px]" style={{ color: C.soft }}>Hidden tests only show pass or fail. Check edge cases: smallest input, duplicates, large values.</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-4"><p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.soft }}>{title}</p><div className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{children}</div></div>;
}
function Pair({ label, value }: { label: string; value: string }) {
  return <div className="mt-1.5"><p className="text-[11.5px]" style={{ color: C.soft }}>{label}</p><pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap rounded-md px-2.5 py-1.5 font-mono text-[12.5px]" style={{ background: C.bg, color: C.text }}>{value}</pre></div>;
}
