"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronDown, Loader2, Play, Send, Table2 } from "lucide-react";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import type { InvestigationContent } from "@/lib/arena-workstations/tools/investigation";
import type { AnswerField } from "@/lib/workplace/investigate/types";
import { ResultView } from "./ResultView";
import { useDraft, type ToolProps } from "./useDraft";

const STARTER = "-- Explore the company's data. Nothing here is graded; run as many queries as you like (Ctrl/⌘ + Enter).\n-- Your findings below are what gets graded.\n\n";
const FIELD = "mt-1.5 w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13.5px] font-normal text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15";

function Field({ field, value, onChange, disabled }: { field: AnswerField; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label className="block font-lp-body text-[13px] font-semibold text-app-charcoal">
      {field.label}
      {field.help && <span className="mt-0.5 block text-[12px] font-normal text-app-muted">{field.help}</span>}
      {field.type === "choice" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={FIELD}>
          <option value="">Choose…</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <span className="relative block">
          {field.type === "number" && field.unit && <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-[13.5px] text-app-muted">{field.unit}</span>}
          <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} inputMode={field.type === "number" ? "decimal" : "text"} maxLength={200} placeholder={field.type === "text" ? field.placeholder : "0.00"} className={`${FIELD} ${field.type === "number" && field.unit ? "pl-7" : ""}`} />
        </span>
      )}
    </label>
  );
}

/** Investigate the company's data with SQL, then report what you found. The data is explored freely; only the findings are graded. */
export function InvestigationTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<InvestigationContent>) {
  const [query, setQuery] = useDraft(attemptId, "query", STARTER);
  const [answers, setAnswers] = useDraft<Record<string, string>>(attemptId, "answers", {});
  const [note, setNote] = useDraft(attemptId, "note", "");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTable, setOpenTable] = useState<string | null>(content.tables[0]?.name ?? null);

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
      setError("Could not reach the query engine, check your connection.");
    } finally {
      setRunning(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  }

  const complete = content.fields.every((f) => (answers[f.key] ?? "").trim() !== "");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="shrink-0 lg:w-[240px]">
          <h3 className="flex items-center gap-1.5 font-lp-body text-[12px] font-semibold text-app-charcoal"><Table2 size={13} aria-hidden /> The company&apos;s data</h3>
          <div className="mt-2 flex flex-col gap-2">
            {content.tables.map((t) => {
              const open = openTable === t.name;
              return (
                <div key={t.name} className="rounded-lg border border-app-border bg-white">
                  <button type="button" aria-expanded={open} onClick={() => setOpenTable(open ? null : t.name)} className="flex w-full items-center justify-between px-3 py-2 text-left font-lp-mono text-[12.5px] font-semibold text-app-charcoal">
                    {t.name}
                    <span className="flex items-center gap-2 font-normal text-app-muted">{t.rows.length}<ChevronDown size={14} className={open ? "rotate-180" : ""} aria-hidden /></span>
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
                      <button type="button" onClick={() => { const sql = `SELECT * FROM ${t.name} LIMIT 20;`; setQuery(sql); run(sql); }} className="mt-2.5 font-lp-mono text-[11px] font-semibold text-app-blue hover:underline">Preview 20 rows</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2 font-lp-mono text-[11px] text-white/50"><span>explore.sql</span><span className="hidden sm:block">Ctrl/⌘ + Enter to run</span></div>
            <textarea value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} spellCheck={false} wrap="off" aria-label="SQL editor" disabled={closed} className="block h-[180px] w-full resize-none overflow-auto bg-transparent px-4 py-3 font-lp-mono text-[13px] leading-[1.6] text-[#e8e8e8] caret-app-orange outline-none disabled:opacity-60" />
          </div>
          {!closed && (
            <button type="button" onClick={() => run()} disabled={running || !query.trim()} className="flex w-fit items-center gap-1.5 rounded-lg border border-app-border bg-white px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-50">
              {running ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />} Run query
            </button>
          )}
          {error && <p role="alert" className="rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}
          <section className="rounded-xl border border-app-border bg-white p-4">
            <h3 className="mb-3 font-lp-body text-[12px] font-semibold text-app-charcoal">Result</h3>
            {result ? <ResultView result={result} /> : <p className="font-lp-body text-[12.5px] text-app-muted">Run a query to look at the data.</p>}
          </section>
        </div>
      </div>

      <section aria-labelledby="findings-h" className="rounded-xl border border-app-border bg-white p-5">
        <h3 id="findings-h" className="font-lp-display text-[18px] font-bold text-app-charcoal">{content.kind === "incident" ? "Your incident report" : "Your findings"}</h3>
        <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">Report what the data shows. You can submit again if a finding is wrong.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {content.fields.map((f) => <Field key={f.key} field={f} value={answers[f.key] ?? ""} onChange={(v) => setAnswers({ ...answers, [f.key]: v })} disabled={closed} />)}
        </div>
        {!closed && (
          <>
            <label className="mt-4 block font-lp-body text-[12px] font-semibold text-app-charcoal">
              Note to the requester <span className="font-normal text-app-muted">(optional: how you found it, what you would do next)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className={FIELD} />
            </label>
            <button type="button" onClick={() => onSubmit({ answers, note: note.trim() || undefined })} disabled={submitting || !complete} className="mt-4 flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
              {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Submit findings
            </button>
          </>
        )}
      </section>
    </div>
  );
}
