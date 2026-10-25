"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleX } from "lucide-react";
import type { SessionReport } from "@/lib/arena-roles/session/report";
import { DIMENSIONS, type Dimension } from "@/lib/arena-roles/session/signals";

const NAME: Record<Dimension, string> = { analysis: "Analysis", discovery: "Discovery", planning: "Planning", judgement: "Judgement", execution: "Execution", aiCollaboration: "AI collaboration" };
const LEVEL = ["Not shown", "Basic", "Solid", "Strong"];

/** Pure label for a dimension level; null means there was nothing to assess (never a low mark). */
export const levelLabel = (level: 0 | 1 | 2 | 3 | null): string => (level === null ? "Not assessed" : LEVEL[level]);

/** The report of a finished Proof Session: what was verified, then how the session went, with the limits stated. Private to the student. */
export function ReportView({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<SessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/arena/sessions/${sessionId}/report`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setReport(b.report) : setError(b.error ?? "Could not load the report.")))
      .catch(() => setError("Could not reach the server."));
  }, [sessionId]);

  if (error) return <p className="rounded-lg bg-app-rose-container px-4 py-2.5 font-lp-body text-[13px] text-app-rose">{error}</p>;
  if (!report) return <p className="font-lp-body text-[13px] text-app-muted">Loading your report…</p>;

  return (
    <section className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-8" aria-label="Proof Session report">
      <h3 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Your Proof Session report</h3>
      <p className="mt-2 font-lp-body text-[14px] leading-relaxed text-[var(--m-ink)]">{report.claim}</p>

      <h4 className="mt-6 font-lp-body text-[13px] font-bold uppercase tracking-wide text-app-muted">Verified by the checks</h4>
      <ul className="mt-2 flex flex-col gap-1.5">
        {report.stages.map((s) => (
          <li key={s.key} className="flex items-center gap-2 font-lp-body text-[13.5px] text-[var(--m-ink)]">
            {s.passed ? <CheckCircle2 size={15} className="text-app-success" /> : <CircleX size={15} className="text-app-rose" />}
            {s.title}
            <span className="font-lp-mono text-[11.5px] text-app-muted">
              {s.checksPassed}/{s.checksTotal} checks
            </span>
          </li>
        ))}
      </ul>

      <h4 className="mt-6 font-lp-body text-[13px] font-bold uppercase tracking-wide text-app-muted">How the session went</h4>
      <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">Read from your session log. These never decide pass or fail.</p>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        {DIMENSIONS.map((d) => {
          const sig = report.dimensions[d];
          return (
            <div key={d} className="rounded-xl border border-[var(--m-rule)] px-4 py-3">
              <dt className="flex items-center justify-between font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)]">
                {NAME[d]}
                <span className="rounded-full bg-[#F1F3F4] px-2.5 py-0.5 text-[12px]">{levelLabel(sig.level)}</span>
              </dt>
              <dd className="mt-1 font-lp-body text-[12.5px] leading-relaxed text-app-muted">
                {sig.basis}
                {!sig.trusted && " (based on activity your browser reported, so lower confidence)"}
              </dd>
            </div>
          );
        })}
      </dl>

      <h4 className="mt-6 font-lp-body text-[13px] font-bold uppercase tracking-wide text-app-muted">What this does not show</h4>
      <ul className="mt-2 list-disc pl-5 font-lp-body text-[12.5px] leading-relaxed text-app-muted">
        {report.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
        <li>This is a simulated task. It is not a certification and does not predict performance in a job.</li>
      </ul>
    </section>
  );
}
