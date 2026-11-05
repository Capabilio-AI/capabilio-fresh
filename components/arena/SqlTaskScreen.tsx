"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, Play, Send, XCircle } from "lucide-react";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";
import type { PublicSqlTask } from "@/lib/arena-challenges/workbench/sql-task";
import { Countdown } from "./workstations/Countdown";
import type { ChallengeDetail } from "./ChallengeSolvePanel";

// Full-screen SQL workbench: the brief and the tables on the left, the editor and the result table on the right. Light, high-contrast palette like the code screen.
const C = { bg: "#ffffff", panel: "#f5f2ea", line: "#aeb6c4", text: "#0b0d12", soft: "#3a4352", accent: "#c2410c", ok: "#0a7d4f", bad: "#b3162e", okBg: "#d9f4e6", badBg: "#fde0e6" };
const DIFF_COLOR: Record<string, string> = { easy: "#0a7d4f", medium: "#8a5a00", hard: "#b3162e" };
const PREVIEW_ROWS = 8;

type Cell = string | number | null;
interface Table { columns: string[]; rows: Cell[][]; truncated?: boolean }
type Out = { kind: "run"; table: Table; matches: boolean; message: string } | { kind: "error"; message: string } | { kind: "submit"; accepted: boolean; message: string; points: number };

const draftKey = (id: string) => `capabilio:sql:${id}`;
const readDraft = (id: string): string | null => { try { return localStorage.getItem(draftKey(id)); } catch { return null; } };

export function SqlTaskScreen({ challenge, task, onDone }: { challenge: ChallengeDetail; task: PublicSqlTask; onDone: () => void }) {
  const [query, setQuery] = useState(task.starter);
  const [tab, setTab] = useState(task.tables[0]?.name ?? "");
  const [pane, setPane] = useState<"task" | "query">("task");
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [locked, setLocked] = useState(challenge.solved === true);
  const [expiresAt] = useState(() => new Date(Date.now() + challenge.time_limit_minutes * 60_000).toISOString());
  const [overTime, setOverTime] = useState(false);
  const noop = useCallback(() => setOverTime(true), []);
  useEffect(() => { queueMicrotask(() => setQuery(readDraft(challenge.id) ?? task.starter)); }, [challenge.id, task.starter]);

  function edit(next: string) {
    setQuery(next);
    try { localStorage.setItem(draftKey(challenge.id), next); } catch { /* drafts are a convenience */ }
  }

  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
    return data;
  }

  async function run() {
    setBusy("run"); setPane("query");
    try {
      const data = await post("/api/arena/workbench", { challengeId: challenge.id, query });
      setOut(data.error ? { kind: "error", message: data.error } : { kind: "run", table: { columns: data.columns, rows: data.rows, truncated: data.truncated }, matches: data.matches, message: data.message });
    } catch (e) { setOut({ kind: "error", message: (e as Error).message }); } finally { setBusy(null); }
  }

  async function submit() {
    setBusy("submit"); setPane("query");
    try {
      const data = await post("/api/arena/challenges/submit", { challengeId: challenge.id, query });
      setOut({ kind: "submit", accepted: data.isCorrect, message: data.stdout || (data.isCorrect ? "Correct." : "Not quite."), points: data.pointsEarned });
      if (data.isCorrect) setLocked(true);
    } catch (e) { setOut({ kind: "error", message: (e as Error).message }); } finally { setBusy(null); }
  }

  const disabled = busy !== null || locked;
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-bold disabled:opacity-50";
  const shown = task.tables.find((t) => t.name === tab) ?? task.tables[0];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: C.bg, color: C.text, colorScheme: "light" }}>
      <header className="flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
        <button type="button" onClick={onDone} className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: C.soft }}><ArrowLeft size={15} /> Challenges</button>
        <span className="text-[14px] font-extrabold">{challenge.title}</span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" style={{ color: DIFF_COLOR[challenge.difficulty], border: `1px solid ${DIFF_COLOR[challenge.difficulty]}66` }}>{challenge.difficulty}</span>
        <span className="font-mono text-[12.5px] font-semibold" style={{ color: overTime ? C.bad : C.soft }}>{overTime ? "Over time" : <Countdown target={expiresAt} onDone={noop} />}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" disabled={disabled} onClick={run} className={btn} style={{ background: C.line, color: C.text }}><Play size={14} /> {busy === "run" ? "Running…" : "Run"}</button>
          <button type="button" disabled={disabled} onClick={submit} className={btn} style={{ background: C.accent, color: "#fff" }}><Send size={14} /> {busy === "submit" ? "Checking…" : "Submit"}</button>
        </div>
      </header>

      <div className="flex border-b lg:hidden" style={{ borderColor: C.line }}>
        {([["task", "Task & data"], ["query", "Query"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setPane(id)} className="flex-1 py-2 text-[13px] font-bold" style={{ color: pane === id ? C.accent : C.soft, borderBottom: pane === id ? `2px solid ${C.accent}` : "2px solid transparent" }}>{label}</button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <section className={`${pane === "task" ? "block" : "hidden"} min-h-0 overflow-y-auto p-5 lg:block`} style={{ borderRight: `1px solid ${C.line}` }}>
          <h1 className="text-[20px] font-extrabold">{challenge.title}</h1>
          <p className="mt-0.5 text-[12px]" style={{ color: C.soft }}>{challenge.category} · +{pointsForDifficulty(challenge.difficulty)} pts</p>
          <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed">{task.prompt}</p>
          {task.mode !== "script" && task.ordered && <p className="mt-2 text-[12.5px]" style={{ color: C.soft }}>The rows must come back in the order the task asks for.</p>}
          <p className="mt-6 text-[12px] font-bold uppercase tracking-wide" style={{ color: C.soft }}>Tables</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {task.tables.map((t) => <button key={t.name} type="button" onClick={() => setTab(t.name)} className="rounded-md px-3 py-1 font-mono text-[12.5px] font-bold" style={{ background: tab === t.name ? C.line : C.panel, color: C.text }}>{t.name}</button>)}
          </div>
          {shown && (
            <div className="mt-3">
              <ul className="mb-2 grid gap-0.5 text-[12.5px] sm:grid-cols-2" style={{ color: C.soft }}>
                {shown.columns.map((c) => <li key={c.name}><span className="font-mono font-bold" style={{ color: C.text }}>{c.name}</span> {c.type}{c.description ? ` · ${c.description}` : ""}</li>)}
              </ul>
              <Grid table={{ columns: shown.columns.map((c) => c.name), rows: shown.rows.slice(0, PREVIEW_ROWS) }} />
              <p className="mt-1 text-[12px]" style={{ color: C.soft }}>First {Math.min(PREVIEW_ROWS, shown.rows.length)} of {shown.rows.length} rows. Query the table to see the rest.</p>
            </div>
          )}
        </section>

        <section className={`${pane === "query" ? "flex" : "hidden"} min-h-0 flex-col lg:flex`}>
          {locked && <div className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold" style={{ background: C.okBg, color: C.ok }}><Lock size={14} /> Completed. This challenge is locked and can no longer be edited.</div>}
          <textarea value={query} readOnly={locked} spellCheck={false} aria-label={task.mode === "script" ? "SQL script editor" : "SQL editor"} onChange={(e) => edit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget, s = t.selectionStart; edit(query.slice(0, s) + "  " + query.slice(t.selectionEnd)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !disabled) { e.preventDefault(); void run(); }
            }}
            className="min-h-0 flex-[3] resize-none whitespace-pre px-4 py-3 font-mono text-[13.5px] leading-[1.6] outline-none" style={{ background: C.bg, color: C.text, caretColor: C.text, tabSize: 2 }} />
          <div className="min-h-0 flex-[2] overflow-y-auto p-3 text-[13px]" style={{ borderTop: `1px solid ${C.line}`, background: C.panel }}>
            {!out && <p style={{ color: C.soft }}>{task.mode === "script" ? "Write your statements (you can use several, ending each with a semicolon) and press Run (or Ctrl/⌘ + Enter). Run applies them to a fresh copy of the database and shows the preview; Submit checks the database they leave behind." : "Write a SELECT query and press Run (or Ctrl/⌘ + Enter) to see its table. Submit checks it against the expected result."}</p>}
            {out?.kind === "error" && <p role="alert" className="flex items-start gap-1.5 font-semibold" style={{ color: C.bad }}><XCircle size={15} className="mt-0.5 shrink-0" /> {out.message}</p>}
            {out?.kind === "run" && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: out.matches ? C.ok : C.soft }}>{out.matches ? <CheckCircle2 size={15} /> : null}{out.matches ? (task.mode === "script" ? "The database now matches what the task asks for. Submit to lock it in." : "This result matches the expected one. Submit to lock it in.") : out.message}</p>
                {out.table.columns.length > 0 && <Grid table={out.table} />}
              </div>
            )}
            {out?.kind === "submit" && (
              <p className="flex items-center gap-2 text-[16px] font-extrabold" style={{ color: out.accepted ? C.ok : C.bad }}>
                {out.accepted ? <CheckCircle2 size={18} /> : <XCircle size={18} />}{out.accepted ? `Accepted · +${out.points} pts` : out.message}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Grid({ table }: { table: Table }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.line}`, background: C.bg }}>
      <table className="w-full border-collapse font-mono text-[12.5px]">
        <thead><tr>{table.columns.map((c) => <th key={c} className="px-2.5 py-1.5 text-left font-bold" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="px-2.5 py-1" style={{ borderBottom: `1px solid ${C.panel}`, color: v === null ? C.soft : C.text }}>{v === null ? "NULL" : String(v)}</td>)}</tr>)}
          {table.rows.length === 0 && <tr><td className="px-2.5 py-2" colSpan={Math.max(1, table.columns.length)} style={{ color: C.soft }}>No rows.</td></tr>}
        </tbody>
      </table>
      {table.truncated && <p className="px-2.5 py-1 text-[12px]" style={{ color: C.soft }}>Showing the first rows only.</p>}
    </div>
  );
}
