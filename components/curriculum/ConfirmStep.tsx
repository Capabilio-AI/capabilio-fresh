import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ImportSummary } from "@/lib/curriculum/admin-data";
import type { ImportStatus } from "@/lib/curriculum/mapping-rules";
import { Panel } from "@/components/org/ui";
import { StatusButton } from "./StatusButton";

interface Props {
  importId: string;
  summary: ImportSummary;
  coursesWithoutOutcomes: number;
}

/** A plain checklist, then one decision. Warnings never block — they say what students will and won't see. */
export function ConfirmStep({ importId, summary, coursesWithoutOutcomes }: Props) {
  const confirmed = summary.status === "CONFIRMED";
  const frozen = summary.status === "PUBLISHED" || summary.status === "ARCHIVED";
  const checks: { ok: boolean; text: string }[] = [
    { ok: summary.courses > 0, text: summary.courses > 0 ? `${summary.courses} courses` : "No courses yet — add at least one." },
    { ok: Boolean(summary.regulation), text: summary.regulation ? `Regulation ${summary.regulation}` : "No regulation stated (fine for a single curriculum; a new regulation should be named so versions stay separate)." },
    { ok: coursesWithoutOutcomes === 0, text: coursesWithoutOutcomes === 0 ? "Every course has learning outcomes." : `${coursesWithoutOutcomes} course(s) have no learning outcomes.` },
    { ok: summary.confirmedMappings > 0, text: summary.confirmedMappings > 0 ? `${summary.confirmedMappings} confirmed skill mapping${summary.confirmedMappings === 1 ? "" : "s"} — these are what students' roadmaps use.` : "No confirmed skill mappings yet — students' roadmaps will have nothing to match until you confirm some." },
    { ok: summary.mappingsNeedingReview === 0, text: summary.mappingsNeedingReview === 0 ? "No suggestions waiting for review." : `${summary.mappingsNeedingReview} suggested mapping(s) are still unreviewed. They stay suggestions and have no effect on students.` },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Before you confirm">
        <ul className="flex flex-col gap-2">
          {checks.map((c) => (
            <li key={c.text} className="flex items-start gap-2 font-lp-body text-[13px] text-app-charcoal">
              {c.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-app-success" aria-label="Done" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-app-warning" aria-label="Needs attention" />}
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        {frozen ? (
          <p className="font-lp-body text-[13px] text-app-muted">This curriculum is {summary.status.toLowerCase()} and can&apos;t be changed.</p>
        ) : confirmed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-lp-body text-[13px] text-app-success">Confirmed. The next step makes it live for students.</p>
            <Link href={`/org/curriculum/${importId}?step=publish`} className="o-btn">Go to publish</Link>
            <StatusButton importId={importId} to="UNDER_REVIEW" label="Back to review" ghost />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-lp-body text-[13px] text-app-muted">Confirming marks your review as complete. You can still go back and edit until you publish.</p>
            <StatusButton importId={importId} to="CONFIRMED" label="Confirm curriculum" then={`/org/curriculum/${importId}?step=publish`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
