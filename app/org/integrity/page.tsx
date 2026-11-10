import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { loadIntegrityReport, REPORT_DAYS } from "@/lib/integrity/report";
import { INTEGRITY_KINDS, INTEGRITY_LABEL } from "@/lib/integrity/kinds";
import { EmptyState, PageHeader } from "@/components/org/ui";

export const metadata: Metadata = { title: "Integrity — Capabilio AI" };

const SHOWN = 100;

export default async function IntegrityPage() {
  const { ctx, service } = await orgPageContext("viewRoster");
  const all = await loadIntegrityReport(service, ctx.institutionId);
  const flagged = all.filter((s) => s.score > 0);
  const rows = flagged.slice(0, SHOWN);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrity"
        subtitle={`How students behaved on SkillStudio and Arena in the last ${REPORT_DAYS} days: blocked paste, copy and screenshot attempts, solves that came too fast, and answers that match another student's.`}
      />
      <p className="max-w-[70ch] rounded-xl bg-[var(--m-accent-soft)] px-4 py-3 text-[13.5px] leading-relaxed text-app-charcoal">
        These are signals, not proof. A paste attempt can be a mistake, leaving the window can be a phone call, and similar answers can come from a common textbook solution. Talk to the student before drawing a conclusion.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing to review" body={all.length === 0 ? "There are no active students in this college yet." : "No student has triggered an integrity signal in this period."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-app-border bg-white">
          <table className="w-full min-w-[56rem] border-collapse text-left text-[13.5px]">
            <caption className="sr-only">Students with integrity signals, strongest first</caption>
            <thead>
              <tr className="border-b border-app-border text-[12px] uppercase tracking-wide text-app-muted">
                <th scope="col" className="px-4 py-3 font-bold">Student</th>
                {INTEGRITY_KINDS.map((k) => <th key={k} scope="col" className="px-3 py-3 text-right font-bold">{INTEGRITY_LABEL[k]}</th>)}
                <th scope="col" className="px-3 py-3 text-right font-bold">Rapid solves</th>
                <th scope="col" className="px-4 py-3 font-bold">Similar answers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.userId} className="border-b border-app-border align-top last:border-0">
                  <th scope="row" className="px-4 py-3 font-bold text-app-charcoal">
                    {s.name}
                    <span className="block text-[12px] font-normal text-app-muted">{[s.rollNumber, s.branch, s.year ? `Year ${s.year}` : null].filter(Boolean).join(" · ")}</span>
                  </th>
                  {INTEGRITY_KINDS.map((k) => <td key={k} className="px-3 py-3 text-right tabular-nums">{s.counts[k] ?? 0}</td>)}
                  <td className="px-3 py-3 text-right tabular-nums">{s.rapid}</td>
                  <td className="px-4 py-3">
                    {s.similar.length === 0 ? "None" : (
                      <ul className="flex flex-col gap-1">
                        {s.similar.slice(0, 3).map((m, i) => <li key={i}>{m.challenge}: matches {m.with ?? "a student from another college"}</li>)}
                        {s.similar.length > 3 && <li className="text-app-muted">and {s.similar.length - 3} more</li>}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {flagged.length > SHOWN && <p className="text-[13px] text-app-muted">Showing the {SHOWN} strongest of {flagged.length} students with signals.</p>}
    </div>
  );
}
