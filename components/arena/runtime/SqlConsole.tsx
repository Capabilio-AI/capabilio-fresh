"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Play, Table2 } from "lucide-react";
import type { Database, SqlJsStatic } from "sql.js";
import { loadScript } from "@/lib/arena-runtime/client/load-script";
import { listSchema, runQuery, type QueryOutcome, type TableInfo } from "@/lib/arena-runtime/client/sql-console";
import { DataTable } from "../workstations/DataTable";
import { asRecord, checksOf, text, type RuntimeProps } from "./types";

declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

/**
 * SQL console on sql.js (SQLite compiled to WebAssembly, MIT). Queries run in the student's browser against the seed in assets.seedSql;
 * the server re-runs the submitted query against the same seed and the hidden ground-truth query to grade it.
 */
export function SqlConsole({ view, draft, onDraft, disabled }: RuntimeProps) {
  const seed = typeof view.assets?.seedSql === "string" ? view.assets.seedSql : "";
  const queries = asRecord<string>(draft.queries);
  const tasks = checksOf(view, "QUERY_RESULT");
  const dbRef = useRef<Database | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [results, setResults] = useState<Record<string, QueryOutcome>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadScript("/vendor/sql.js/sql-wasm.js");
        const SQL = await window.initSqlJs!({ locateFile: (f) => `/vendor/sql.js/${f}` });
        const db = new SQL.Database();
        db.run(seed);
        if (cancelled) return db.close();
        dbRef.current?.close();
        dbRef.current = db;
        setSchema(listSchema(db));
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seed, attempt]);

  useEffect(() => () => dbRef.current?.close(), []);

  const run = (id: string) => {
    const db = dbRef.current;
    if (db) setResults((r) => ({ ...r, [id]: runQuery(db, queries[id] ?? "") }));
  };
  const onKey = (id: string) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run(id);
    }
  };

  if (state === "loading")
    return (
      <p className="flex items-center gap-2 font-lp-body text-[13px] text-app-muted">
        <Loader2 size={15} className="animate-spin" /> Preparing your SQL console…
      </p>
    );
  if (state === "error")
    return (
      <div className="rounded-lg border border-app-border bg-white p-4 font-lp-body text-[13px]">
        <p className="text-app-rose">The SQL console could not start.</p>
        <button type="button" onClick={() => { setState("loading"); setAttempt((n) => n + 1); }} className="mt-2 font-semibold text-app-blue hover:underline">Try again</button>
      </div>
    );

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <aside className="shrink-0 lg:w-[240px]" aria-label="Schema">
        <h3 className="flex items-center gap-1.5 font-lp-body text-[12px] font-semibold text-app-charcoal"><Table2 size={13} /> Schema</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {schema.map((t) => (
            <li key={t.name} className="rounded-lg border border-app-border bg-white px-3 py-2">
              <p className="font-lp-mono text-[12px] font-semibold text-app-charcoal">{t.name}</p>
              <ul className="mt-1">{t.columns.map((c) => <li key={c.name} className="font-lp-mono text-[11px] text-app-muted">{c.name} <span className="opacity-60">{c.type}</span></li>)}</ul>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {tasks.length === 0 && <p className="font-lp-body text-[13px] text-app-muted">This challenge has no query tasks yet.</p>}
        {tasks.map((task, i) => {
          const outcome = results[task.id];
          return (
            <section key={task.id} aria-label={`Query ${i + 1}`}>
              {text(task.public?.prompt) && <p className="mb-1.5 font-lp-body text-[13.5px] font-semibold text-app-charcoal">{text(task.public?.prompt)}</p>}
              <textarea
                value={queries[task.id] ?? ""}
                onChange={(e) => onDraft({ ...draft, queries: { ...queries, [task.id]: e.target.value } })}
                onKeyDown={onKey(task.id)}
                spellCheck={false}
                rows={6}
                disabled={disabled}
                placeholder="SELECT …   (Ctrl/⌘ + Enter to run)"
                className="w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-mono text-[13px] leading-relaxed"
              />
              <button type="button" onClick={() => run(task.id)} disabled={disabled} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-app-charcoal px-3.5 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-50">
                <Play size={12} /> Run
              </button>
              <p className="mt-1 font-lp-body text-[11.5px] text-app-muted">Running is only a preview. Your final query is graded when you submit.</p>
              {outcome && (
                <div className="mt-3" aria-live="polite">
                  {outcome.ok ? (
                    <DataTable columns={outcome.columns.map((name) => ({ name, type: "text" }))} rows={outcome.rows} caption={`${outcome.rows.length} row${outcome.rows.length === 1 ? "" : "s"}${outcome.truncated ? " (truncated)" : ""}`} />
                  ) : (
                    <p className="rounded-lg border border-app-rose/40 bg-app-rose-container px-3 py-2 font-lp-mono text-[12px] text-app-rose">{outcome.error}</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
