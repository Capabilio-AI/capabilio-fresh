"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, Database, Hash, KeyRound, Loader2, Play, Send, Table2, Type, Calendar } from "lucide-react";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import type { SqlContent } from "@/lib/arena-workstations/tools/sql";
import { ResultView } from "./ResultView";
import { tokenizeSql, type SqlTokenKind } from "./sql-highlight";
import { useDraft, type ToolProps } from "./useDraft";

const DEBUG_NOTE = "-- This query has a bug. Read the ticket for the symptom, find the cause and fix it. Run it as often as you like. Only Submit is graded.\n";
const queryStarter = (engine: string) => `-- Your team's analytics warehouse (${engine}). Run as often as you like (Ctrl/⌘ + Enter).\n-- Only Submit is graded.\n\n`;
const scriptStarter = (engine: string) => `-- ${engine}: write the SQL script that does the job (several statements are fine). Run as often as you like (Ctrl/⌘ + Enter).\n-- Each run starts from a fresh copy of the data. Only Submit is graded.\n\n`;

const TOKEN_CLASS: Record<SqlTokenKind, string> = {
  keyword: "font-semibold text-[#8ab4ff]",
  string: "text-[#9fd88a]",
  number: "text-[#ffb27a]",
  comment: "italic text-white/40",
  plain: "text-[#e6e6e6]",
};

/** Elapsed milliseconds since the call; kept out of the component because reading the clock is impure. */
const stopwatch = () => {
  const t = performance.now();
  return () => Math.round(performance.now() - t);
};

const EDITOR_TEXT = "font-lp-mono text-[13px] leading-[1.6] [font-variant-ligatures:none]";

function ColumnIcon({ name, type }: { name: string; type: string }) {
  if (/(^|_)id$/.test(name)) return <KeyRound size={11} className="shrink-0 text-[#b7791f]" aria-label="identifier" />;
  if (type === "number") return <Hash size={11} className="shrink-0 text-app-muted" />;
  if (type === "date") return <Calendar size={11} className="shrink-0 text-app-muted" />;
  return <Type size={11} className="shrink-0 text-app-muted" />;
}

/**
 * A SQL client in the shape analysts use all day (DBeaver, SSMS, DataGrip): a database navigator on the left, a highlighted editor with a toolbar, a
 * numbered result grid and a footer that says how many rows came back and how long it took. Same engine and grading as before.
 */
export function SqlTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<SqlContent>) {
  const script = content.mode === "script";
  const engine = content.engine === "postgres" ? "PostgreSQL" : "SQLite";
  const opening = content.starter ? `${DEBUG_NOTE}\n${content.starter}\n` : script ? scriptStarter(engine) : queryStarter(engine);
  const [query, setQuery] = useDraft(attemptId, "query", opening);
  const [note, setNote] = useDraft(attemptId, "note", "");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTables, setOpenTables] = useState<Set<string>>(() => new Set(content.tables.slice(0, 1).map((t) => t.name)));
  const overlayRef = useRef<HTMLPreElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  async function run(sql = query, explore = false) {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    const elapsed = stopwatch();
    try {
      const res = await fetch(`/api/arena/domain/attempts/${attemptId}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: sql, explore }) });
      const data = await res.json();
      if (!res.ok && !("columns" in data)) setError(data.error ?? "Could not run the query.");
      else setResult(data);
      setTookMs(elapsed());
    } catch {
      setError("Could not reach the query engine — check your connection.");
    } finally {
      setRunning(false);
    }
  }

  function toggle(name: string) {
    const next = new Set(openTables);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setOpenTables(next);
  }

  /** Types a name into the editor where the caret is, as double-clicking a column in a client does. */
  function insertAtCaret(text: string) {
    const el = areaRef.current;
    if (!el || closed) return;
    const { selectionStart: s, selectionEnd: e } = el;
    setQuery(query.slice(0, s) + text + query.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + text.length, s + text.length);
    });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = el;
      setQuery(query.slice(0, s) + "  " + query.slice(end));
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
  }

  const lines = query.split("\n").length;
  const rowCount = result && "rows" in result ? result.rows.length : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="shrink-0 overflow-hidden rounded-xl border border-app-border bg-white lg:w-[270px]" aria-label="Database navigator">
        <div className="flex items-center gap-2 border-b border-app-border bg-app-background px-3 py-2 font-lp-body text-[12px] font-semibold text-app-charcoal">
          <Database size={13} />
          Database Navigator
        </div>
        <div className="px-2 py-2">
          <p className="flex items-center gap-1.5 px-1 py-1 font-lp-mono text-[12px] font-semibold text-app-charcoal">
            <Database size={12} className="text-app-blue" />
            warehouse
            <span className="font-normal text-app-muted">· {engine}</span>
          </p>
          <ul className="ml-3 border-l border-app-border pl-1.5">
            {content.tables.map((t) => {
              const open = openTables.has(t.name);
              return (
                <li key={t.name}>
                  <div className="flex items-center rounded hover:bg-app-background">
                    <button type="button" aria-expanded={open} onClick={() => toggle(t.name)} className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1 text-left font-lp-mono text-[12px] text-app-charcoal">
                      <ChevronRight size={12} className={`shrink-0 text-app-muted transition-transform ${open ? "rotate-90" : ""}`} />
                      <Table2 size={12} className="shrink-0 text-app-blue" />
                      <span className="truncate font-semibold">{t.name}</span>
                      <span className="ml-auto shrink-0 pl-2 text-[10.5px] text-app-muted">{t.rows.length}</span>
                    </button>
                    <button
                      type="button"
                      title={`Preview 20 rows of ${t.name}`}
                      onClick={() => {
                        const sql = `SELECT * FROM ${t.name} LIMIT 20;`;
                        if (!script) setQuery(sql);
                        run(sql, true);
                      }}
                      className="mr-1 rounded px-1.5 py-0.5 font-lp-mono text-[10.5px] font-semibold text-app-blue hover:bg-app-blue-container"
                    >
                      Preview
                    </button>
                  </div>
                  {open && (
                    <ul className="ml-4 border-l border-app-border pb-1 pl-1">
                      {t.columns.map((c) => (
                        <li key={c.name}>
                          <button type="button" onDoubleClick={() => insertAtCaret(c.name)} title={`${c.description ?? c.name} — double-click to insert`} className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left font-lp-mono text-[11.5px] hover:bg-app-background">
                            <ColumnIcon name={c.name} type={c.type} />
                            <span className="truncate text-app-charcoal">{c.name}</span>
                            <span className="ml-auto shrink-0 text-[10.5px] text-app-muted">{c.type}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]">
          <div className="flex items-end justify-between border-b border-[#2a2a2a] bg-[#101010] pr-3">
            <span className="flex items-center gap-2 border-r border-t-2 border-[#2a2a2a] border-t-app-orange bg-[#161616] px-4 py-1.5 font-lp-mono text-[11.5px] text-white/80">
              {script ? "script.sql" : "query.sql"}
            </span>
            <span className="hidden pb-1.5 font-lp-mono text-[10.5px] text-white/40 sm:block">{engine} · Ctrl/⌘ + Enter to run</span>
          </div>
          {!closed && (
            <div className="flex items-center gap-2 border-b border-[#2a2a2a] bg-[#1c1c1c] px-3 py-1.5">
              <button type="button" onClick={() => run()} disabled={running || !query.trim()} title="Execute (Ctrl/⌘ + Enter)" className="flex items-center gap-1.5 rounded bg-[#2e7d32] px-3 py-1 font-lp-body text-[12px] font-semibold text-white hover:bg-[#388e3c] disabled:opacity-50">
                {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                {script ? "Run script" : "Run"}
              </button>
              <button type="button" onClick={() => onSubmit({ query, note: note.trim() || undefined })} disabled={submitting || !query.trim()} className="ml-auto flex items-center gap-1.5 rounded bg-white px-3 py-1 font-lp-body text-[12px] font-semibold text-app-charcoal hover:bg-white/90 disabled:opacity-50">
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {script ? "Submit script" : "Submit query"}
              </button>
            </div>
          )}
          <div className="relative flex h-[260px]">
            <div aria-hidden className={`select-none overflow-hidden border-r border-[#2a2a2a] bg-[#131313] py-3 pl-3 pr-2 text-right text-white/30 ${EDITOR_TEXT}`}>
              {Array.from({ length: lines }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <pre ref={overlayRef} aria-hidden className={`pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre py-3 pl-3 pr-4 ${EDITOR_TEXT}`}>
                {tokenizeSql(query).map((t, i) => (
                  <span key={i} className={TOKEN_CLASS[t.kind]}>
                    {t.text}
                  </span>
                ))}
                {"\n"}
              </pre>
              <textarea
                ref={areaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                onScroll={(e) => {
                  const el = overlayRef.current;
                  if (el) {
                    el.scrollTop = e.currentTarget.scrollTop;
                    el.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
                spellCheck={false}
                wrap="off"
                aria-label={script ? "SQL script editor" : "SQL editor"}
                disabled={closed}
                className={`absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-3 pl-3 pr-4 text-transparent caret-app-orange outline-none selection:bg-[#3b5b9a]/60 disabled:opacity-60 ${EDITOR_TEXT}`}
              />
            </div>
          </div>
        </div>

        {error && <p className="rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}

        <section className="overflow-hidden rounded-xl border border-app-border bg-white" aria-label="Results">
          <div className="flex items-center border-b border-app-border bg-app-background px-3 font-lp-body text-[12px]">
            <span className="border-b-2 border-app-blue px-2 py-2 font-semibold text-app-charcoal">{script ? "Data after your script" : "Results"}</span>
          </div>
          <div className="p-3">
            {result ? <ResultView result={result} /> : <p className="font-lp-body text-[12.5px] text-app-muted">{script ? "Run your script to see the data after it ran. Use Preview on a table to look at the original data." : "Run a query to see its result here."}</p>}
          </div>
          <div className="flex items-center gap-4 border-t border-app-border bg-app-background px-3 py-1 font-lp-mono text-[11px] text-app-muted">
            <span>{running ? "Executing…" : result ? ("error" in result ? "Failed" : "Success") : "Ready"}</span>
            {rowCount !== null && <span>{rowCount} row{rowCount === 1 ? "" : "s"} fetched</span>}
            {tookMs !== null && <span>{tookMs} ms</span>}
            <span className="ml-auto">{engine}</span>
          </div>
        </section>

        {!closed && (
          <label className="block rounded-xl border border-app-border bg-white p-4 font-lp-body text-[12px] font-semibold text-app-charcoal">
            Note to the requester <span className="font-normal text-app-muted">(optional — what you found, any caveats)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className="mt-2 w-full resize-y rounded-lg border border-app-border px-3 py-2 font-lp-body text-[13px] font-normal outline-none focus:ring-2 focus:ring-app-charcoal/15" />
          </label>
        )}
      </div>
    </div>
  );
}
