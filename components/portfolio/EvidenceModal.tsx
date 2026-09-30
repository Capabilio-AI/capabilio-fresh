"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, CircleX } from "lucide-react";
import { sqlOutputDetail, type AttemptEvidence } from "@/lib/arena/attempt-evidence";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

interface EvidenceModalProps {
  fetchUrl: string;
  onClose: () => void;
}

/** Popup shown when a recruiter or the owner clicks "View evidence" on an Arena task — same detail as the full attempt page, closable without navigating away. */
export function EvidenceModal({ fetchUrl, onClose }: EvidenceModalProps) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; data: AttemptEvidence }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(fetchUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("not ok"))))
      .then((data: AttemptEvidence) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="float-right rounded-full p-1.5 text-app-muted hover:bg-app-background hover:text-app-charcoal">
          <X size={18} />
        </button>

        {state.status === "loading" && <p className="py-10 text-center font-lp-body text-[13.5px] text-app-muted">Loading evidence…</p>}
        {state.status === "error" && <p className="py-10 text-center font-lp-body text-[13.5px] text-app-muted">Couldn&apos;t load this evidence.</p>}

        {state.status === "ready" && (
          <>
            <p className="font-lp-mono text-[11.5px] text-app-muted">{[state.data.company, state.data.areaName, state.data.toolLabel].filter(Boolean).join(" · ")}</p>
            <h2 className="mt-1 pr-8 font-lp-display text-[20px] font-semibold text-app-charcoal">{state.data.title}</h2>
            <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-lp-body text-[12.5px] font-semibold ${state.data.completedAt ? "bg-app-success-container text-app-success" : "bg-app-attention-container text-app-attention"}`}>
              {state.data.completedAt ? <CheckCircle2 size={14} /> : <CircleX size={14} />}
              {state.data.completedAt ? `Verified Arena submission · ${fmt(state.data.completedAt)}` : "Not yet verified"}
            </p>

            <section className="mt-5 rounded-xl border border-app-border p-4">
              <h3 className="font-lp-body text-[13px] font-semibold text-app-charcoal">The request</h3>
              {state.data.requester && <p className="mt-1 font-lp-mono text-[11.5px] text-app-muted">From {state.data.requester}</p>}
              <p className="mt-2 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{state.data.scenario}</p>
              <ul className="mt-3 flex flex-col gap-1">
                {state.data.objectiveLines.map((l, i) => (
                  <li key={i} className="font-lp-body text-[13px] text-app-charcoal">
                    {l}
                  </li>
                ))}
              </ul>
            </section>

            {state.data.grade && (
              <section className="mt-3 rounded-xl border border-app-border p-4">
                <h3 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Deterministic grading</h3>
                <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{state.data.grade.message}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {state.data.grade.checks.map((c) => (
                    <li key={c.label} className={`font-lp-mono text-[12px] ${c.passed ? "text-app-success" : "text-app-rose"}`}>
                      {c.passed ? "✓" : "✗"} {c.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {state.data.submissionText && (
              <section className="mt-3 rounded-xl border border-app-border p-4">
                <h3 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Submitted work</h3>
                <pre className="mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-lg bg-app-background p-3 font-lp-mono text-[12px] text-app-charcoal">{state.data.submissionText}</pre>
              </section>
            )}

            {(() => {
              const output = sqlOutputDetail(state.data.grade?.detail);
              if (!output) return null;
              return (
                <section className="mt-3 rounded-xl border border-app-border p-4">
                  <h3 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Output</h3>
                  {"error" in output ? (
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-app-rose-container p-3 font-lp-mono text-[12px] text-app-rose">{output.error}</pre>
                  ) : (
                    <div className="mt-2 max-h-[240px] overflow-auto rounded-lg border border-app-border">
                      <table className="w-full border-collapse font-lp-mono text-[12px]">
                        <thead className="sticky top-0 bg-app-background">
                          <tr>
                            {output.columns.map((c) => (
                              <th key={c} className="border-b border-app-border px-2.5 py-1.5 text-left font-semibold text-app-charcoal">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {output.rows.map((row, i) => (
                            <tr key={i} className="border-b border-app-border last:border-0 even:bg-app-background/60">
                              {row.map((cell, ci) => (
                                <td key={ci} className={`whitespace-nowrap px-2.5 py-1 ${cell === null ? "text-app-rose" : "text-app-charcoal"}`}>
                                  {cell === null ? "NULL" : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })()}

            <section className="mt-3 rounded-xl border border-app-border p-4">
              <h3 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Audit trail</h3>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 font-lp-mono text-[11.5px] sm:grid-cols-2">
                {[
                  ["Assigned", fmt(state.data.assignedAt)],
                  ["Verified", fmt(state.data.completedAt)],
                  ["Rotation cycle", state.data.cycleNumber ?? "—"],
                  ["Submissions", state.data.submissionCount],
                  ["Difficulty", state.data.difficulty],
                  ["Generated by", state.data.generationProvider ? `${state.data.generationProvider} · ${state.data.generationModel}` : "hand-authored (legacy)"],
                  ["Generation version", state.data.generationVersion ?? "—"],
                  ["Grading version", state.data.gradingVersion ?? "—"],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between gap-3 border-b border-app-border py-1">
                    <dt className="text-app-muted">{k}</dt>
                    <dd className="text-right text-app-charcoal">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
