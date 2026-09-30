import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleX } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getAttemptEvidence, sqlOutputDetail } from "@/lib/arena/attempt-evidence";

export const metadata: Metadata = { title: "Arena task — Capabilio AI" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/** Evidence detail for one Arena attempt — the target of every Arena "View evidence" link. Owner-only. */
export default async function AttemptEvidencePage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { user } = await requireAuthedUser();
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  const evidence = await getAttemptEvidence(createServiceClient(), attemptId, user.id);
  if (!evidence) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/portfolio" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-app-charcoal">
        <ArrowLeft size={14} />
        Portfolio
      </Link>
      <p className="mt-4 font-lp-mono text-[11.5px] text-app-muted">{[evidence.company, evidence.areaName, evidence.toolLabel].filter(Boolean).join(" · ")}</p>
      <h1 className="mt-1 font-lp-display text-[24px] font-semibold text-app-charcoal">{evidence.title}</h1>
      <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-lp-body text-[12.5px] font-semibold ${evidence.completedAt ? "bg-app-success-container text-app-success" : "bg-app-attention-container text-app-attention"}`}>
        {evidence.completedAt ? <CheckCircle2 size={14} /> : <CircleX size={14} />}
        {evidence.completedAt ? `Verified Arena submission · ${fmt(evidence.completedAt)}` : "Not yet verified"}
      </p>

      <section className="mt-6 rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">The request</h2>
        {evidence.requester && <p className="mt-1 font-lp-mono text-[11.5px] text-app-muted">From {evidence.requester}</p>}
        <p className="mt-2 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{evidence.scenario}</p>
        <ul className="mt-3 flex flex-col gap-1">
          {evidence.objectiveLines.map((l, i) => (
            <li key={i} className="font-lp-body text-[13px] text-app-charcoal">
              {l}
            </li>
          ))}
        </ul>
      </section>

      {evidence.grade && (
        <section className="mt-4 rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Deterministic grading</h2>
          <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{evidence.grade.message}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {evidence.grade.checks.map((c) => (
              <li key={c.label} className={`font-lp-mono text-[12px] ${c.passed ? "text-app-success" : "text-app-rose"}`}>
                {c.passed ? "✓" : "✗"} {c.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {evidence.submissionText && (
        <section className="mt-4 rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Submitted work</h2>
          <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg bg-app-background p-3 font-lp-mono text-[12px] text-app-charcoal">{evidence.submissionText}</pre>
        </section>
      )}

      {(() => {
        const output = sqlOutputDetail(evidence.grade?.detail);
        if (!output) return null;
        return (
          <section className="mt-4 rounded-xl border border-app-border bg-white p-5">
            <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Output</h2>
            {"error" in output ? (
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-app-rose-container p-3 font-lp-mono text-[12px] text-app-rose">{output.error}</pre>
            ) : (
              <div className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-app-border">
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

      <section className="mt-4 rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-body text-[13px] font-semibold text-app-charcoal">Audit trail</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 font-lp-mono text-[11.5px] sm:grid-cols-2">
          {[
            ["Assigned", fmt(evidence.assignedAt)],
            ["Verified", fmt(evidence.completedAt)],
            ["Rotation cycle", evidence.cycleNumber ?? "—"],
            ["Submissions", evidence.submissionCount],
            ["Difficulty", evidence.difficulty],
            ["Generated by", evidence.generationProvider ? `${evidence.generationProvider} · ${evidence.generationModel}` : "hand-authored (legacy)"],
            ["Generation version", evidence.generationVersion ?? "—"],
            ["Grading version", evidence.gradingVersion ?? "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-3 border-b border-app-border py-1">
              <dt className="text-app-muted">{k}</dt>
              <dd className="text-right text-app-charcoal">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
