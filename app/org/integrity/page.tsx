import type { Metadata } from "next";
import { orgPageContext } from "@/lib/org/page";
import { can } from "@/lib/org/roles";
import { outcomeTabs } from "@/lib/org/section-tabs";
import { SectionTabs } from "@/components/org/SectionTabs";
import { loadIntegrityReport, REPORT_DAYS } from "@/lib/integrity/report";
import { INTEGRITY_KINDS, INTEGRITY_LABEL } from "@/lib/integrity/kinds";
import { EmptyState, PageHeader, Panel } from "@/components/org/ui";

export const metadata: Metadata = { title: "Integrity — Capabilio AI" };

const SHOWN = 100;

export default async function IntegrityPage() {
  const { ctx, service } = await orgPageContext("viewRoster");
  const all = await loadIntegrityReport(service, ctx.institutionId);
  const flagged = all.filter((s) => s.score > 0);
  const rows = flagged.slice(0, SHOWN);

  return (
    <div className="flex flex-col gap-6">
      <SectionTabs label="Outcomes sections" active="/org/integrity" tabs={outcomeTabs(can(ctx, "viewOutcomes"), true)} />
      <PageHeader
        title="Integrity"
        subtitle={`How students behaved in exams, SkillStudio and Arena in the last ${REPORT_DAYS} days: blocked paste, copy and screenshot attempts, leaving full screen, solves that came too fast, and answers that match another student's.`}
      />
      <p className="max-w-[70ch] rounded-xl bg-[var(--m-accent-soft)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--m-ink)]">
        These are signals, not proof. A paste attempt can be a mistake, leaving the window can be a phone call, and similar answers can come from a common textbook solution. Talk to the student before drawing a conclusion.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing to review" body={all.length === 0 ? "There are no active students in this college yet." : "No student has triggered an integrity signal in this period."} />
      ) : (
        <Panel className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-left text-[13.5px] text-[var(--m-ink)]">
              <caption className="sr-only">Students with integrity signals, strongest first</caption>
              <thead>
                <tr className="border-b border-[var(--m-rule)]! text-[11.5px] uppercase tracking-wide text-[var(--m-muted)]">
                  <th scope="col" className="min-w-[15rem] px-4 py-3 font-bold">Student</th>
                  {INTEGRITY_KINDS.map((k) => <th key={k} scope="col" className="px-3 py-3 text-center font-bold leading-tight">{INTEGRITY_LABEL[k]}</th>)}
                  <th scope="col" className="px-3 py-3 text-center font-bold leading-tight">Rapid solves</th>
                  <th scope="col" className="min-w-[14rem] px-4 py-3 font-bold">Similar answers</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.userId} className="border-b border-[var(--m-rule)]! align-top last:border-0">
                    <th scope="row" className="px-4 py-3 font-bold">
                      {s.name}
                      <span className="mt-0.5 block text-[12px] font-normal text-[var(--m-muted)]">{[s.rollNumber, s.branch, s.year ? `Year ${s.year}` : null].filter(Boolean).join(" · ")}</span>
                    </th>
                    {[...INTEGRITY_KINDS.map((k) => s.counts[k] ?? 0), s.rapid].map((n, i) => (
                      <td key={i} className="px-3 py-3 text-center tabular-nums">
                        {n === 0 ? <span className="text-[var(--m-off)]">–</span> : <span className="inline-block min-w-7 rounded-full bg-[var(--m-accent-soft)] px-2 py-0.5 font-bold text-[var(--m-accent-ink)]">{n}</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {s.similar.length === 0 ? <span className="text-[var(--m-off)]">None</span> : (
                        <ul className="flex flex-col gap-1">
                          {s.similar.slice(0, 3).map((m, i) => <li key={i}>{m.challenge}: matches {m.with ?? "a student from another college"}</li>)}
                          {s.similar.length > 3 && <li className="text-[var(--m-muted)]">and {s.similar.length - 3} more</li>}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {flagged.length > SHOWN && <p className="text-[13px] text-[var(--m-muted)]">Showing the {SHOWN} strongest of {flagged.length} students with signals.</p>}
    </div>
  );
}
