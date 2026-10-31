import type { ImportStatus } from "@/lib/curriculum/mapping-rules";
import type { ImportSummary, Person } from "@/lib/curriculum/admin-data";
import { COURSE_GROUPS, GROUP_LABEL } from "@/lib/curriculum/composition";
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
        {cell("Syllabus entries", summary.courses)}
        {cell("Learning outcomes", summary.outcomes)}
        {cell("Skills identified", summary.skillsIdentified)}
        {cell("Mappings to review", summary.mappingsNeedingReview, summary.mappingsNeedingReview > 0 ? "text-app-warning" : "text-app-success")}
      </dl>
      {summary.courses > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="o-eyebrow">Made up of</span>{COURSE_GROUPS.filter((g) => summary.composition[g] > 0).map((g) => <Pill key={g}>{summary.composition[g]} {GROUP_LABEL[g].toLowerCase()}</Pill>)}</div>}
      <div className="mt-4 flex items-center gap-2"><span className="o-eyebrow">Status</span><StatusPill status={summary.status} /></div>
    </section>
  );
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** A person's avatar and name with what they did ("Uploaded by"), so every curriculum shows who is accountable for it. */
export function PersonChip({ label, person, at }: { label: string; person: Person | null; at?: string | null }) {
  const when = at ? new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  return (
    <div className="flex items-center gap-2.5">
      {person?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
        <img src={person.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="o-logo-tile grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px]" aria-hidden="true">{person ? initialsOf(person.name) : "?"}</span>
      )}
      <div className="min-w-0">
        <p className="o-eyebrow">{label}</p>
        <p className="truncate font-lp-body text-[12.5px] font-semibold text-app-charcoal">{person?.name ?? "Former member"}{when ? <span className="font-normal text-app-muted"> · {when}</span> : null}</p>
      </div>
    </div>
  );
}
