import type { ImportStatus } from "@/lib/curriculum/mapping-rules";
import type { ImportSummary } from "@/lib/curriculum/admin-data";
import { Pill } from "@/components/org/ui";

const STATUS: Record<ImportStatus, { label: string; tone: "neutral" | "ok" | "warn" | "info" | "bad" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  EXTRACTED: { label: "Ready for review", tone: "info" },
  UNDER_REVIEW: { label: "Under review", tone: "warn" },
  CONFIRMED: { label: "Confirmed — ready to publish", tone: "ok" },
  PUBLISHED: { label: "Published", tone: "ok" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};
export const statusLabel = (s: ImportStatus) => STATUS[s].label;
export const StatusPill = ({ status }: { status: ImportStatus }) => <Pill tone={STATUS[status].tone}>{STATUS[status].label}</Pill>;

export const yearsLabel = (years: number[]) => (years.length === 0 ? "—" : years.length === 1 ? `Year ${years[0]}` : `Years ${years[0]}–${years[years.length - 1]}`);

/** The summary at the top of a curriculum: what was found, and what still needs a person. */
export function SummaryCard({ summary }: { summary: ImportSummary }) {
  const cell = (label: string, value: string | number, tone = "text-app-charcoal") => (
    <div>
      <dt className="o-eyebrow">{label}</dt>
      <dd className={`mt-1 font-lp-body text-[15px] font-semibold ${tone}`}>{value}</dd>
    </div>
  );
  return (
    <section className="o-card p-5" aria-label="Curriculum summary">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {cell("Program", summary.program ?? "Not stated")}
        {cell("Branch", summary.branch)}
        {cell("Regulation", summary.regulation ?? "Not stated")}
        {cell("Years covered", yearsLabel(summary.years))}
        {cell("Courses", summary.courses)}
        {cell("Learning outcomes", summary.outcomes)}
        {cell("Skills identified", summary.skillsIdentified)}
        {cell("Mappings to review", summary.mappingsNeedingReview, summary.mappingsNeedingReview > 0 ? "text-app-warning" : "text-app-success")}
      </dl>
      <div className="mt-4 flex items-center gap-2"><span className="o-eyebrow">Status</span><StatusPill status={summary.status} /></div>
    </section>
  );
}
