"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Play, Send, XCircle } from "lucide-react";
import { CodeEditor } from "@/components/skillstudio/learn/CodeEditor";
import { DEFAULT_RULES, ExamLock, useExamLock } from "@/components/exam/ExamLock";
import { JUDGE_LANGUAGES, starterFor, type JudgeLanguage } from "@/lib/arena-challenges/leetcode/starters";
import { TIER_PASS_PCT, type TierNumber } from "@/lib/languages/tiers";
import type { ProofArea, ProofProblem } from "@/lib/languages/tier-proof";

interface ExampleResult { index: number; passed: boolean; input: string; expected: string; actual: string; error: string }
interface Outcome { proven: boolean; passed: number; total: number; results: { challengeId: string; passed: boolean }[] }

const draftKey = (id: string, lang: JudgeLanguage) => `capabilio:proof:${id}:${lang}`;
const readDraft = (id: string, lang: JudgeLanguage): string | null => { try { return localStorage.getItem(draftKey(id, lang)); } catch { return null; } };

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
  return data;
}

interface Props { area: ProofArea; tier: TierNumber; tierLabel: string; problems: ProofProblem[] }

/** The proof test runs in the exam lock: full screen, strikes for leaving it or switching tabs, and a test the lock ends is submitted as it stands. */
export function TierProofScreen(props: Props) {
  return (
    <ExamLock area="skillstudio" title={`${props.tierLabel} proof`} storageKey={`proof-${props.area}-${props.tier}`} rules={[...DEFAULT_RULES, `You can write each problem in a different language. ${TIER_PASS_PCT}% of the problems must pass every hidden test.`]}>
      <ProofRunner {...props} />
    </ExamLock>
  );
}

/** The proof test: every problem has its own language choice and editor; the examples can be run any time, and one Submit judges all on hidden tests. */
function ProofRunner({ area, tier, tierLabel, problems }: Props) {
  const lock = useExamLock();
  const lockRef = useRef(lock);
  useEffect(() => { lockRef.current = lock; });
  const [at, setAt] = useState(0);
  const [langs, setLangs] = useState<Record<string, JudgeLanguage>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<Record<string, ExampleResult[]>>({});
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const p = problems[at];
  const lang = langs[p.id] ?? "python";
  const keyed = `${p.id}:${lang}`;
  const code = codes[keyed] ?? starterFor(p.problem, lang);

  // restore a saved draft once per problem and language (localStorage is browser-only)
  useEffect(() => {
    const saved = readDraft(p.id, lang);
    if (saved !== null) queueMicrotask(() => setCodes((c) => (c[keyed] === undefined ? { ...c, [keyed]: saved } : c)));
  }, [p.id, lang, keyed]);

  function edit(next: string) {
    setCodes((c) => ({ ...c, [keyed]: next }));
    try { localStorage.setItem(draftKey(p.id, lang), next); } catch { /* drafts are a convenience */ }
  }

  async function run() {
    setBusy("run"); setError(null);
    try {
      const data = await post("/api/learning/tier-proof/run", { area, tier, challengeId: p.id, language: lang, code });
      setRuns((r) => ({ ...r, [p.id]: data.results }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function submit() {
    setBusy("submit"); setError(null);
    try {
      const answers = problems.map((q) => { const l = langs[q.id] ?? "python"; return { challengeId: q.id, language: l, code: codes[`${q.id}:${l}`] ?? "" }; });
      setOutcome(await post("/api/learning/tier-proof", { area, tier, answers }));
      lockRef.current?.release();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  // too many strikes end the test: what is written so far is judged, once
  const autoSubmitted = useRef(false);
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });
  useEffect(() => {
    if (lock?.terminated && !autoSubmitted.current) { autoSubmitted.current = true; void submitRef.current(); }
  }, [lock?.terminated]);

  if (outcome) {
    return (
      <div className="ss-studio flex flex-col gap-4 pt-6">
        <h1 className="font-lp-display text-[32px] font-bold text-[var(--m-ink)]">{outcome.proven ? `${tierLabel} proven` : "Not proven yet"}</h1>
        <p className="text-[15px] text-[var(--m-muted)]">{outcome.passed} of {outcome.total} problems passed every test. {outcome.proven ? "The next tier's proof is now open." : `You need ${TIER_PASS_PCT}% to prove this tier. Keep practising and try again; you will get a fresh set next week.`}</p>
        <ul className="flex flex-col gap-2">{outcome.results.map((r, i) => <li key={r.challengeId} className="flex items-center gap-2 text-[14px]" style={{ color: r.passed ? "var(--m-accent-ink)" : "var(--m-muted)" }}>{r.passed ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}{problems[i]?.title ?? "Problem"}: {r.passed ? "passed" : "not passed"}</li>)}</ul>
        <Link href="/skillstudio/courses" className="text-[14px] font-bold text-[var(--m-accent-ink)]">Back to courses</Link>
      </div>
    );
  }

  return (
    <div className="ss-studio flex flex-col gap-4 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{tierLabel} proof</p>
          <h1 className="font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">{p.title}</h1>
        </div>
        <nav aria-label="Problems" className="flex gap-1.5">{problems.map((q, i) => <button key={q.id} type="button" onClick={() => { setAt(i); setError(null); }} aria-current={i === at ? "step" : undefined} className={`ss-num rounded-lg border px-3 py-1.5 text-[13px] font-bold ${i === at ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-rule)] text-[var(--m-ink)]"}`}>{i + 1}</button>)}</nav>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3 text-[14px] leading-relaxed text-[var(--m-ink)]">
          <p className="whitespace-pre-wrap">{p.problem.statement}</p>
          <p><b>Input.</b> {p.problem.inputFormat}</p>
          <p><b>Output.</b> {p.problem.outputFormat}</p>
          {p.problem.constraints.length > 0 && <ul className="list-disc pl-5 font-lp-mono text-[13px]">{p.problem.constraints.map((c) => <li key={c}>{c}</li>)}</ul>}
          {p.problem.examples.map((ex, i) => <div key={i} className="rounded-xl border border-[var(--m-rule)] p-3"><p className="text-[12px] font-bold uppercase text-[var(--m-muted)]">Example {i + 1}</p><pre className="mt-1 whitespace-pre-wrap font-lp-mono text-[12.5px]">{ex.input.trimEnd()}</pre><pre className="mt-1 whitespace-pre-wrap font-lp-mono text-[12.5px]">{"→ " + ex.output.trimEnd()}</pre></div>)}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] font-bold text-[var(--m-ink)]" htmlFor="proof-lang">Language</label>
            <select id="proof-lang" value={lang} onChange={(e) => setLangs((l) => ({ ...l, [p.id]: e.target.value as JudgeLanguage }))} disabled={busy !== null} className="rounded-lg border border-[var(--m-rule)] bg-white px-2.5 py-1.5 text-[13px]">
              {JUDGE_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button type="button" onClick={run} disabled={busy !== null || code.trim() === ""} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--m-rule)] px-3.5 py-1.5 text-[13px] font-bold disabled:opacity-50"><Play size={14} aria-hidden />{busy === "run" ? "Running…" : "Run examples"}</button>
          </div>
          <CodeEditor value={code} onChange={edit} onRun={run} label={`Code for ${p.title}`} minRows={14} />
          {error && <p role="alert" className="text-[13px] font-semibold text-red-700">{error}</p>}
          {runs[p.id]?.map((r) => (
            <div key={r.index} className="rounded-xl border border-[var(--m-rule)] p-3 text-[13px]">
              <p className="flex items-center gap-1.5 font-bold" style={{ color: r.passed ? "var(--m-accent-ink)" : "#b91c1c" }}>{r.passed ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}Example {r.index + 1} {r.passed ? "passed" : "failed"}</p>
              {!r.passed && <pre className="mt-1 whitespace-pre-wrap font-lp-mono text-[12.5px]">{`expected ${r.expected.trimEnd()}\ngot      ${r.actual || "(no output)"}${r.error ? `\n${r.error}` : ""}`}</pre>}
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--m-rule)] pt-3">
            <p className="text-[12.5px] text-[var(--m-muted)]">One Submit judges all {problems.length} problems on hidden tests. {TIER_PASS_PCT}% must pass.</p>
            <button type="button" onClick={submit} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-accent)] px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50"><Send size={14} aria-hidden />{busy === "submit" ? "Judging…" : "Submit proof"}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
