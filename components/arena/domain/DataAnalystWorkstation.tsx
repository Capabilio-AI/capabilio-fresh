"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, Database, Loader2, Play, Send, Table2 } from "lucide-react";
import type { SqlResult } from "@/lib/domain-workstations/sql-runner";
import type { GradeFeedback } from "@/lib/domain-workstations/grade";
import type { SchemaTable } from "@/lib/domain-workstations/urbankart";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";
import { ResultView } from "./ResultView";
import { Countdown } from "./Countdown";

export interface ActiveTicket {
  assignmentId: string;
  assignedAt: string;
  ticket: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    time_limit_minutes: number;
    scenario: string;
    objective: string;
    starter_code: string | null;
    skill_tags: string[];
    requester: string | null;
    sequence: number | null;
  };
}

export const ticketCode = (sequence: number | null) => `DA-${100 + (sequence ?? 0)}`;

const draftKey = (assignmentId: string) => `domain-draft:${assignmentId}`;
function readDraft(assignmentId: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(assignmentId));
  } catch {
    return null;
  }
}
function writeDraft(assignmentId: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(draftKey(assignmentId));
    else window.localStorage.setItem(draftKey(assignmentId), value);
  } catch {
    // Private mode / blocked storage — drafts just won't persist.
  }
}

export function DataAnalystWorkstation({
  active,
  company,
  schema,
  onClose,
}: {
  active: ActiveTicket;
  company: string;
  schema: SchemaTable[];
  onClose: (ticketClosed: boolean) => void;
}) {
  const { ticket, assignmentId } = active;
  const [query, setQuery] = useState(() => readDraft(assignmentId) ?? ticket.starter_code ?? "");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<GradeFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<{ nextAvailableAt: string; points: number } | null>(null);
  const [openTable, setOpenTable] = useState<string | null>(schema[0]?.name ?? null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const requesterName = ticket.requester?.split("·")[0].trim() ?? "the requester";

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function updateQuery(value: string) {
    setQuery(value);
    writeDraft(assignmentId, value);
  }

  async function run(sql = query) {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/arena/domain/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
      const data = await res.json();
      if (!res.ok && !("columns" in data)) setError(data.error ?? "Could not run the query.");
      else setResult(data);
    } catch {
      setError("Could not reach the query engine — check your connection.");
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    if (!query.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/arena/domain/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, query, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit — try again.");
        return;
      }
      setFeedback(data.feedback);
      setResult(data.result);
      if (data.feedback.passed) {
        writeDraft(assignmentId, null);
        setClosed({ nextAvailableAt: data.nextAvailableAt, points: data.pointsEarned });
      }
    } catch {
      setError("Could not reach the server — your ticket is still open.");
    } finally {
      setSubmitting(false);
    }
  }

  function onEditorKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      updateQuery(query.slice(0, start) + "  " + query.slice(end));
      requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
    }
  }

  function preview(table: string) {
    const sql = `SELECT * FROM ${table} LIMIT 20;`;
    updateQuery(sql);
    run(sql);
  }

  const lineCount = query.split("\n").length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app-background" role="dialog" aria-modal="true" aria-label={`Ticket ${ticketCode(ticket.sequence)}: ${ticket.title}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-app-charcoal px-4 py-3 text-white sm:px-6">
        <button type="button" onClick={() => onClose(closed !== null)} className="flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-white/80 hover:text-white">
          <ArrowLeft size={15} />
          Arena
        </button>
        <span className="hidden h-5 w-px bg-white/20 sm:block" />
        <span className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold">
          <Database size={15} className="text-app-orange" />
          {company} · Analytics
        </span>
        <span className="ml-auto flex items-center gap-3 font-lp-mono text-[11.5px]">
          <span className="text-white/60">{ticketCode(ticket.sequence)}</span>
          <span className={`rounded px-2 py-0.5 font-semibold ${closed ? "bg-app-success text-white" : "bg-white/10 text-white"}`}>{closed ? "Closed" : "In progress"}</span>
          <span className="font-semibold text-app-orange">+{pointsForDifficulty(ticket.difficulty)} pts</span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="shrink-0 border-b border-app-border bg-white lg:w-[340px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <section className="p-5">
            <p className="font-lp-mono text-[11px] text-app-muted">
              {ticket.category} · est. {ticket.time_limit_minutes} min
            </p>
            <h2 className="mt-1 font-lp-display text-[18px] font-semibold leading-snug text-app-charcoal">{ticket.title}</h2>

            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-blue-container font-lp-body text-[12px] font-bold text-app-blue">
                {requesterName
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="font-lp-body text-[12.5px] leading-tight text-app-charcoal">
                <span className="font-semibold">{requesterName}</span>
                <span className="block text-app-muted">{ticket.requester?.split("·")[1]?.trim()}</span>
              </span>
            </div>
            <p className="mt-3 rounded-lg bg-app-background px-3.5 py-3 font-lp-body text-[13px] leading-relaxed text-app-charcoal">{ticket.scenario}</p>

            <h3 className="mt-5 font-lp-body text-[12px] font-semibold text-app-charcoal">Deliverable</h3>
            <p className="mt-1 font-lp-body text-[13px] leading-relaxed text-app-charcoal">{ticket.objective}</p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {ticket.skill_tags.map((t) => (
                <span key={t} className="rounded bg-app-attention-container px-2 py-0.5 font-lp-mono text-[10.5px] text-app-attention">
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section className="border-t border-app-border p-5">
            <h3 className="flex items-center gap-1.5 font-lp-body text-[12px] font-semibold text-app-charcoal">
              <Table2 size={13} />
              Warehouse schema
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              {schema.map((table) => {
                const isOpen = openTable === table.name;
                return (
                  <div key={table.name} className="rounded-lg border border-app-border">
                    <button
                      type="button"
                      onClick={() => setOpenTable(isOpen ? null : table.name)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between px-3 py-2 text-left font-lp-mono text-[12.5px] font-semibold text-app-charcoal"
                    >
                      {table.name}
                      <ChevronDown size={14} className={`text-app-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-app-border px-3 pb-3 pt-2">
                        <p className="font-lp-body text-[11.5px] text-app-muted">{table.description}</p>
                        <ul className="mt-2 flex flex-col gap-1">
                          {table.columns.map((c) => (
                            <li key={c.name} className="flex items-baseline justify-between gap-2 font-lp-mono text-[11.5px]">
                              <span className="text-app-charcoal">{c.name}</span>
                              <span className="text-right text-app-muted">{c.note ?? c.type.toLowerCase()}</span>
                            </li>
                          ))}
                        </ul>
                        <button type="button" onClick={() => preview(table.name)} className="mt-2.5 font-lp-mono text-[11px] font-semibold text-app-blue hover:underline">
                          Preview 20 rows
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:overflow-y-auto">
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616] shadow-sm">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2">
              <span className="font-lp-mono text-[11.5px] text-white/60">{ticketCode(ticket.sequence).toLowerCase()}.sql</span>
              <span className="hidden font-lp-mono text-[11px] text-white/40 sm:block">Ctrl/⌘ + Enter to run</span>
            </div>
            <div className="flex h-[300px]">
              <div ref={gutterRef} aria-hidden className="select-none overflow-hidden py-3 pl-3 pr-2 text-right font-lp-mono text-[13px] leading-[1.6] text-white/25">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                onKeyDown={onEditorKey}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                spellCheck={false}
                wrap="off"
                aria-label="SQL editor"
                disabled={closed !== null}
                className="h-full flex-1 resize-none overflow-auto bg-transparent py-3 pr-4 font-lp-mono text-[13px] leading-[1.6] text-[#e8e8e8] caret-app-orange outline-none disabled:opacity-60"
              />
            </div>
          </div>

          {!closed && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => run()}
                disabled={running || !query.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal hover:border-app-charcoal/40 disabled:opacity-50"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run query
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !query.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Submit to {requesterName.split(" ")[0]}
              </button>
              <span className="font-lp-body text-[12px] text-app-muted">Run as often as you like — only Submit is graded.</span>
            </div>
          )}

          {error && <p className="rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>}

          {closed && (
            <div className="rounded-xl border border-app-success/30 bg-app-success-container px-5 py-4">
              <p className="flex items-center gap-2 font-lp-body text-[14px] font-semibold text-app-success">
                <CheckCircle2 size={17} />
                Ticket {ticketCode(ticket.sequence)} closed · +{closed.points} pts
              </p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
                {requesterName.split(" ")[0]} has your numbers. Your next ticket arrives in <Countdown target={closed.nextAvailableAt} onDone={noop} />.
              </p>
              <button type="button" onClick={() => onClose(true)} className="mt-3 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white">
                Back to Arena
              </button>
            </div>
          )}

          {feedback && !feedback.passed && (
            <div className="rounded-xl border border-app-warning/30 bg-app-warning-container px-5 py-4" role="status">
              <p className="font-lp-body text-[13.5px] font-semibold text-app-warning">Not quite — the ticket is still open</p>
              <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{feedback.message}</p>
            </div>
          )}

          <section className="rounded-xl border border-app-border bg-white p-4">
            <h3 className="mb-3 font-lp-body text-[12px] font-semibold text-app-charcoal">Result</h3>
            {result ? <ResultView result={result} /> : <p className="font-lp-body text-[12.5px] text-app-muted">Run a query to see its result here.</p>}
          </section>

          {!closed && (
            <section className="rounded-xl border border-app-border bg-white p-4">
              <label htmlFor="requester-note" className="font-lp-body text-[12px] font-semibold text-app-charcoal">
                Note to {requesterName} <span className="font-normal text-app-muted">(optional — what you found, any caveats)</span>
              </label>
              <textarea
                id="requester-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="e.g. App cancellations are 3 points higher than web. Worth checking the payment step."
                className="mt-2 w-full resize-y rounded-lg border border-app-border px-3 py-2 font-lp-body text-[13px] text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15"
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function noop() {}
