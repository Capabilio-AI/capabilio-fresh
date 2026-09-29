"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Loader2, Play, Send, Table2 } from "lucide-react";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import type { SqlContent } from "@/lib/arena-workstations/tools/sql";
import { ResultView } from "./ResultView";
import { useDraft, type ToolProps } from "./useDraft";

const STARTER = "-- Your team's analytics warehouse (SQLite). Run as often as you like (Ctrl/⌘ + Enter).\n-- Only Submit is graded.\n\n";

export function SqlTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<SqlContent>) {
  const [query, setQuery] = useDraft(attemptId, "query", STARTER);
  const [note, setNote] = useDraft(attemptId, "note", "");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTable, setOpenTable] = useState<string | null>(content.tables[0]?.name ?? null);
  const gutterRef = useRef<HTMLDivElement>(null);

  async function run(sql = query) {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/arena/domain/attempts/${attemptId}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
      const data = await res.json();
      if (!res.ok && !("columns" in data)) setError(data.error ?? "Could not run the query.");
      else setResult(data);
    } catch {
      setError("Could not reach the query engine — check your connection.");
    } finally {
      setRunning(false);
    }
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

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="shrink-0 lg:w-[260px]">
        <h3 className="flex items-center gap-1.5 font-lp-body text-[12px] font-semibold text-app-charcoal">
          <Table2 size={13} />
          Warehouse schema
        </h3>
        <div className="mt-2 flex flex-col gap-2">
          {content.tables.map((t) => {
            const open = openTable === t.name;
            return (
              <div key={t.name} className="rounded-lg border border-app-border bg-white">
                <button type="button" aria-expanded={open} onClick={() => setOpenTable(open ? null : t.name)} className="flex w-full items-center justify-between px-3 py-2 text-left font-lp-mono text-[12.5px] font-semibold text-app-charcoal">
                  {t.name}
                  <span className="flex items-center gap-2 font-normal text-app-muted">
                    {t.rows.length} rows
                    <ChevronDown size={14} className={open ? "rotate-180" : ""} />
                  </span>
                </button>
                {open && (
                  <div className="border-t border-app-border px-3 pb-3 pt-2">
                    <ul className="flex flex-col gap-1">
                      {t.columns.map((c) => (
                        <li key={c.name} className="flex items-baseline justify-between gap-2 font-lp-mono text-[11.5px]" title={c.description}>
                          <span className="text-app-charcoal">{c.name}</span>
                          <span className="text-app-muted">{c.type}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `SELECT * FROM ${t.name} LIMIT 20;`;
                        setQuery(sql);
                        run(sql);
                      }}
                      className="mt-2.5 font-lp-mono text-[11px] font-semibold text-app-blue hover:underline"
                    >
                      Preview 20 rows
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]">
          <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2 font-lp-mono text-[11px] text-white/50">
            <span>query.sql</span>
            <span className="hidden sm:block">Ctrl/⌘ + Enter to run</span>
          </div>
          <div className="flex h-[260px]">
            <div ref={gutterRef} aria-hidden className="select-none overflow-hidden py-3 pl-3 pr-2 text-right font-lp-mono text-[13px] leading-[1.6] text-white/25">
              {Array.from({ length: query.split("\n").length }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              onScroll={(e) => {
                if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              spellCheck={false}
              wrap="off"
              aria-label="SQL editor"
              disabled={closed}
              className="h-full flex-1 resize-none overflow-auto bg-transparent py-3 pr-4 font-lp-mono text-[13px] leading-[1.6] text-[#e8e8e8] caret-app-orange outline-none disabled:opacity-60"
            />
          </div>
        </div>

        {!closed && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => run()} disabled={running || !query.trim()} className="flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-50">
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run query
            </button>
            <button
              type="button"
              onClick={() => onSubmit({ query, note: note.trim() || undefined })}
              disabled={submitting || !query.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit query
            </button>
          </div>
        )}
        {error && <p className="rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}

        <section className="rounded-xl border border-app-border bg-white p-4">
          <h3 className="mb-3 font-lp-body text-[12px] font-semibold text-app-charcoal">Result</h3>
          {result ? <ResultView result={result} /> : <p className="font-lp-body text-[12.5px] text-app-muted">Run a query to see its result here.</p>}
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
