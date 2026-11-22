"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleHelp, Code2, Loader2, Play, Send, XCircle } from "lucide-react";
import { CodeEditor } from "@/components/skillstudio/learn/CodeEditor";
import { JUDGE_LANGUAGES, starterFor, type JudgeLanguage } from "@/lib/arena-challenges/leetcode/starters";
import { MODULE_PASS_PCT, type ReviewItem } from "@/lib/languages/module-gate";
import { QuestionList, ReviewList, type TestQuestion } from "@/components/languages/AssessmentView";
import type { PublicProblem } from "@/lib/arena-challenges/leetcode/problem";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import { PREVIEW_SANDBOX_CSP, buildPreviewDoc } from "@/lib/playground/playground";

interface State { assessmentPassedAt: string | null; problemPassedAt: string | null; provenAt: string | null; assessmentAttempts: number; problemAttempts: number }
type StdinProblem = PublicProblem & { kind: "stdin"; title: string };
type SqlProblem = { kind: "sql"; title: string; statement: string; mode: "query" | "script"; tables: Dataset[]; starter: string; ordered: boolean };
type HtmlProblem = { kind: "html"; title: string; statement: string; starter: string; requirements: string[] }
interface PageRow { index: number; text: string; passed: boolean }
interface Loaded { language: string; state: State; questions: TestQuestion[]; problem: StdinProblem | SqlProblem | HtmlProblem | null; problemNote: string | null }
type Cells = (string | number | null)[][];
interface SqlRow { index: number; passed: boolean; hidden: boolean; message?: string; expected?: { columns: string[]; rows: Cells }; actual?: { columns: string[]; rows: Cells } }

function Table({ columns, rows, caption }: { columns: string[]; rows: Cells; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--m-rule)]">
      <table className="w-full text-left font-lp-mono text-[12.5px]">
        <caption className="border-b border-[var(--m-rule)] bg-[var(--m-ground)] px-3 py-1.5 text-left font-lp-body text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c} scope="col" className="border-b border-[var(--m-rule)] px-3 py-1 font-bold">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="border-b border-[var(--m-rule)] px-3 py-1">{v === null ? <i className="text-[var(--m-muted)]">NULL</i> : String(v)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
interface Row { index: number; passed: boolean; hidden: boolean; input?: string; expected?: string; actual?: string; error?: string }

async function call(method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch(path, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again."), { unfinished: data.unfinished as string[] | undefined });
  return data;
}

/** A module's test: the assessment and, where the module has one, the problem. Both must pass to prove the module and open the next. */
export function ModuleTest({ track, module, nextHref, nextLabel }: { track: string; module: string; nextHref: string; nextLabel: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState<{ correct: number; total: number; passed: boolean } | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [lang, setLang] = useState<JudgeLanguage>("python");
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<{ kind: "run" | "submit"; rows: Row[]; passed?: boolean } | null>(null);
  const [pageRows, setPageRows] = useState<{ kind: "run" | "submit"; rows: PageRow[]; passed?: boolean; note: string | null } | null>(null);
  const [sqlRows, setSqlRows] = useState<{ kind: "run" | "submit"; rows: SqlRow[]; passed?: boolean } | null>(null);
  const [busy, setBusy] = useState<"assessment" | "run" | "submit" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = (await call("GET", `/api/languages/module?track=${encodeURIComponent(track)}&module=${encodeURIComponent(module)}`)) as Loaded;
      setData(d); setAnswers({}); setScore(null);
      const l = (JUDGE_LANGUAGES.some((x) => x.id === d.language) ? d.language : "python") as JudgeLanguage;
      setLang(l);
      if (d.problem) {
        let saved: string | null = null;
        try { saved = localStorage.getItem(`capabilio:mod:${track}:${module}`); } catch { /* drafts are a convenience */ }
        setCode(saved ?? (d.problem.kind === "sql" || d.problem.kind === "html" ? d.problem.starter : starterFor(d.problem, l)));
      }
    } catch (e) { setError((e as Error).message); }
  }, [track, module]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  if (error) return <p role="alert" className="rounded-xl border border-[var(--m-rule)] bg-white p-5 text-[15px] font-semibold text-red-700">{error}</p>;
  if (!data) return <p role="status" className="flex items-center gap-2 text-[15px] text-[var(--m-muted)]"><Loader2 size={16} className="animate-spin" aria-hidden />Loading the test…</p>;

  const { state, problem } = data;
  const proven = Boolean(state.provenAt);
  const edit = (next: string) => { setCode(next); try { localStorage.setItem(`capabilio:mod:${track}:${module}`, next); } catch { /* drafts are a convenience */ } };

  async function submitAssessment() {
    setBusy("assessment"); setError(null);
    try {
      const r = await call("POST", "/api/languages/module", { action: "assessment", track, module, answers });
      setScore({ correct: r.correct, total: r.total, passed: r.passed });
      setReview(Array.isArray(r.review) ? (r.review as ReviewItem[]) : []);
      setData((d) => (d ? { ...d, state: r.state, questions: r.passed ? [] : d.questions } : d));
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  /** Another try: new questions, and the failed score and the old answers are cleared, so the answers can be sent again. */
  async function tryAgain() {
    setScore(null); setReview([]); setAnswers({}); setError(null);
    await load();
    if (typeof window !== "undefined") document.getElementById("mt-a")?.scrollIntoView({ block: "start" });
  }
  async function runCode(action: "run" | "submit") {
    setBusy(action); setError(null);
    try {
      const r = await call("POST", "/api/languages/module", { action, track, module, code });
      if (r.kind === "html") setPageRows({ kind: action, rows: r.results, passed: r.passed, note: r.note });
      else if (r.kind === "sql") setSqlRows({ kind: action, rows: r.results, passed: r.passed });
      else setRows({ kind: action, rows: r.results, passed: r.passed });
      if (action === "submit") setData((d) => (d ? { ...d, state: r.state } : d));
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  const card = "rounded-2xl border border-[var(--m-rule)] bg-white p-5";
  const answered = data.questions.every((q) => answers[q.id] !== undefined);
  return (
    <div className="flex flex-col gap-5">
      {proven && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#e8f5ee] p-5 text-[#0f5132]">
          <p className="flex items-center gap-2 text-[17px] font-bold"><CheckCircle2 size={20} aria-hidden />Module proven. The next module is open.</p>
          <Link href={nextHref} className="rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white">{nextLabel}</Link>
        </div>
      )}
      {error && <p role="alert" className="text-[14px] font-semibold text-red-700">{error}</p>}

      <section aria-labelledby="mt-a" className={card}>
        <h2 id="mt-a" className="flex items-center gap-2 font-lp-display text-[22px] font-bold text-[var(--m-ink)]"><CircleHelp size={20} aria-hidden />Assessment {state.assessmentPassedAt && <CheckCircle2 size={18} aria-label="Passed" className="text-[#17784a]" />}</h2>
        {state.assessmentPassedAt ? <p className="mt-2 text-[15px] text-[var(--m-ink)]">Passed. Nothing more to do here.</p> : (
          <>
            <p className="mt-1 text-[14.5px] text-[var(--m-muted)]">{data.questions.length} questions from this module. You need {MODULE_PASS_PCT}% to pass. If you miss, the next try draws different questions.{state.assessmentAttempts > 0 && ` Attempts so far: ${state.assessmentAttempts}.`}</p>
            {!(score && !score.passed) && <QuestionList questions={data.questions} answers={answers} onPick={(id, oi) => setAnswers((a) => ({ ...a, [id]: oi }))} track={track} />}
            {score && !score.passed && (
              <div role="status">
                <p className="rounded-xl bg-red-50 p-3 text-[14.5px] font-semibold text-red-800">You got {score.correct} of {score.total}. You need {MODULE_PASS_PCT}%. Read what each missed question was and why, then try again with new questions.</p>
                {review.length > 0 && <ReviewList items={review} />}
                <button type="button" onClick={() => void tryAgain()} disabled={busy !== null} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-50">Try again with new questions</button>
              </div>
            )}
            {!(score && !score.passed) && <button type="button" onClick={() => void submitAssessment()} disabled={busy !== null || !answered} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-50">{busy === "assessment" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}Submit answers</button>}
          </>
        )}
      </section>

      <section aria-labelledby="mt-p" className={card}>
        <h2 id="mt-p" className="flex items-center gap-2 font-lp-display text-[22px] font-bold text-[var(--m-ink)]"><Code2 size={20} aria-hidden />Problem {state.problemPassedAt && <CheckCircle2 size={18} aria-label="Passed" className="text-[#17784a]" />}</h2>
        {!problem ? <p className="mt-2 text-[14.5px] text-[var(--m-muted)]">{data.problemNote ?? "This module is proven by its assessment."}</p> : problem.kind === "sql" ? (
          <div className="mt-2 grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed text-[var(--m-ink)]">
              <h3 className="text-[18px] font-bold">{problem.title}</h3>
              <p className="whitespace-pre-wrap">{problem.statement}</p>
              <p className="text-[13px] text-[var(--m-muted)]">{problem.mode === "script" ? "Write the statements, separated by semicolons. They are checked by looking at the database they leave behind." : problem.ordered ? "Write one SELECT. The order of the rows counts." : "Write one SELECT. The order of the rows does not count."}</p>
              {problem.tables.map((t) => <Table key={t.name} caption={`Table ${t.name}`} columns={t.columns.map((c) => c.name)} rows={t.rows.slice(0, 8)} />)}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-[13px] font-bold text-[var(--m-muted)]">Your answer is checked on these rows and on other rows you cannot see.</p>
              <CodeEditor value={code} onChange={edit} onRun={() => void runCode("run")} label="Your SQL" minRows={12} />
              {state.problemPassedAt ? <p className="text-[14px] font-semibold text-[#17784a]">Passed. Nothing more to do here.</p> : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void runCode("run")} disabled={busy !== null || code.trim() === ""} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--m-rule)] px-4 py-2 text-[13.5px] font-bold disabled:opacity-50">{busy === "run" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />}Run on the shown rows</button>
                  <button type="button" onClick={() => void runCode("submit")} disabled={busy !== null || code.trim() === ""} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-accent)] px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50">{busy === "submit" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}Submit for checking</button>
                </div>
              )}
              {sqlRows && (
                <div role="status" className="flex flex-col gap-3">
                  {sqlRows.kind === "submit" && <p className="flex items-center gap-2 text-[15px] font-bold" style={{ color: sqlRows.passed ? "#17784a" : "#b91c1c" }}>{sqlRows.passed ? <CheckCircle2 size={18} aria-hidden /> : <XCircle size={18} aria-hidden />}{sqlRows.passed ? "Every check passed." : `${sqlRows.rows.filter((r) => r.passed).length} of ${sqlRows.rows.length} checks passed.`}</p>}
                  {sqlRows.rows.map((r) => (
                    <div key={r.index} className="flex flex-col gap-2 rounded-xl border border-[var(--m-rule)] p-3 text-[13px]">
                      <p className="flex items-center gap-1.5 font-bold" style={{ color: r.passed ? "#17784a" : "#b91c1c" }}>{r.passed ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}{r.hidden ? `Hidden check ${r.index}` : "On the rows shown"} {r.passed ? "passed" : "failed"}</p>
                      {r.message && <p className="text-[13px] text-[var(--m-ink)]">{r.message}</p>}
                      {!r.passed && r.expected && <Table caption="Expected" columns={r.expected.columns} rows={r.expected.rows} />}
                      {!r.passed && r.actual && <Table caption="Yours" columns={r.actual.columns} rows={r.actual.rows} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : problem.kind === "html" ? (
          <div className="mt-2 grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed text-[var(--m-ink)]">
              <h3 className="text-[18px] font-bold">{problem.title}</h3>
              <p className="whitespace-pre-wrap">{problem.statement}</p>
              <h4 className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Requirements</h4>
              <ul className="flex flex-col gap-2">
                {problem.requirements.map((text, i) => {
                  const r = pageRows?.rows.find((x) => x.index === i);
                  return (
                    <li key={i} className="flex items-start gap-2 rounded-lg border border-[var(--m-rule)] px-3 py-2 text-[14px]">
                      <span aria-hidden className="mt-0.5 shrink-0">{r ? (r.passed ? <CheckCircle2 size={16} className="text-[#17784a]" /> : <XCircle size={16} className="text-[#b91c1c]" />) : <span className="block h-4 w-4 rounded-full border border-[var(--m-rule)]" />}</span>
                      <span>{text}<span className="sr-only">{r ? (r.passed ? " (met)" : " (not met)") : " (not checked yet)"}</span></span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <CodeEditor value={code} onChange={edit} onRun={() => void runCode("run")} label="Your page" minRows={16} maxRows={28} />
              {state.problemPassedAt ? <p className="text-[14px] font-semibold text-[#17784a]">Passed. Nothing more to do here.</p> : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void runCode("run")} disabled={busy !== null || code.trim() === ""} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--m-rule)] px-4 py-2 text-[13.5px] font-bold disabled:opacity-50">{busy === "run" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />}Check my page</button>
                  <button type="button" onClick={() => void runCode("submit")} disabled={busy !== null || code.trim() === ""} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-accent)] px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50">{busy === "submit" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}Submit</button>
                </div>
              )}
              {pageRows && <p role="status" className="text-[14px] font-bold" style={{ color: pageRows.passed || pageRows.rows.every((r) => r.passed) ? "#17784a" : "#b91c1c" }}>{pageRows.rows.filter((r) => r.passed).length} of {pageRows.rows.length} requirements met.{pageRows.note ? ` ${pageRows.note}` : ""}</p>}
              <div className="overflow-hidden rounded-lg border border-[var(--m-rule)] bg-white">
                <p className="border-b border-[var(--m-rule)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Preview</p>
                {/* the student's page runs in its own sandbox: it can run script but cannot reach this site, its cookies or the network */}
                <iframe title="Preview of your page" sandbox="allow-scripts" srcDoc={buildPreviewDoc("html", code)} data-csp={PREVIEW_SANDBOX_CSP} className="h-[260px] w-full bg-white" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed text-[var(--m-ink)]">
              <h3 className="text-[18px] font-bold">{problem.title}</h3>
              <p className="whitespace-pre-wrap">{problem.statement}</p>
              <p><b>Input.</b> {problem.inputFormat}</p>
              <p><b>Output.</b> {problem.outputFormat}</p>
              {problem.constraints.length > 0 && <ul className="list-disc pl-5 font-lp-mono text-[13px]">{problem.constraints.map((c) => <li key={c}>{c}</li>)}</ul>}
              {problem.examples.map((ex, i) => <div key={i} className="rounded-xl border border-[var(--m-rule)] p-3"><p className="text-[12px] font-bold uppercase text-[var(--m-muted)]">Example {i + 1}</p><pre className="mt-1 whitespace-pre-wrap font-lp-mono text-[12.5px]">{ex.input}</pre><pre className="mt-1 whitespace-pre-wrap font-lp-mono text-[12.5px]">{"→ " + ex.output}</pre>{ex.explanation && <p className="mt-1 text-[13px] text-[var(--m-muted)]">{ex.explanation}</p>}</div>)}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-[13px] font-bold text-[var(--m-muted)]">Write it in {JUDGE_LANGUAGES.find((l) => l.id === lang)?.label ?? lang}, the language of this course.</p>
              <CodeEditor value={code} onChange={edit} onRun={() => void runCode("run")} label="Your solution" minRows={14} />
              {state.problemPassedAt ? <p className="text-[14px] font-semibold text-[#17784a]">Passed. Nothing more to do here.</p> : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void runCode("run")} disabled={busy !== null || code.trim() === ""} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--m-rule)] px-4 py-2 text-[13.5px] font-bold disabled:opacity-50">{busy === "run" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />}Run examples</button>
                  <button type="button" onClick={() => void runCode("submit")} disabled={busy !== null || code.trim() === ""} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-accent)] px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50">{busy === "submit" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}Submit for judging</button>
                </div>
              )}
              {rows && (
                <div role="status" className="flex flex-col gap-2">
                  {rows.kind === "submit" && <p className="flex items-center gap-2 text-[15px] font-bold" style={{ color: rows.passed ? "#17784a" : "#b91c1c" }}>{rows.passed ? <CheckCircle2 size={18} aria-hidden /> : <XCircle size={18} aria-hidden />}{rows.passed ? "Every test passed." : `${rows.rows.filter((r) => r.passed).length} of ${rows.rows.length} tests passed.`}</p>}
                  {rows.rows.filter((r) => !r.hidden).map((r) => (
                    <div key={r.index} className="rounded-xl border border-[var(--m-rule)] p-3 text-[13px]">
                      <p className="flex items-center gap-1.5 font-bold" style={{ color: r.passed ? "#17784a" : "#b91c1c" }}>{r.passed ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}Example {r.index + 1} {r.passed ? "passed" : "failed"}</p>
                      {!r.passed && <pre className="mt-1 whitespace-pre-wrap font-lp-mono text-[12.5px]">{`expected ${r.expected}\ngot      ${r.actual || "(no output)"}${r.error ? `\n${r.error}` : ""}`}</pre>}
                    </div>
                  ))}
                  {rows.kind === "submit" && !rows.passed && rows.rows.some((r) => r.hidden) && <p className="text-[12.5px] text-[var(--m-muted)]">Hidden tests only show pass or fail. Check edge cases: the smallest input, an empty case, large values.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
