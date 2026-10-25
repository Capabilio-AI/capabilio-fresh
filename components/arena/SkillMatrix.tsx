import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import type { MatrixRow } from "@/lib/capability/matrix";
import type { ExperienceLevel } from "@/lib/workplace/level";

const LEVEL_TEXT: Record<ExperienceLevel, string> = { fresher: "Fresher", junior: "Junior", mid: "Mid-level", senior: "Senior", expert: "Expert" };

function Bar({ row }: { row: MatrixRow }) {
  const measured = row.level !== null;
  return (
    <div
      role="img"
      aria-label={measured ? `${row.name}: level ${Math.round(row.level!)} of 100${row.target !== null ? `, target ${row.target}` : ""}` : `${row.name}: not assessed`}
      className={`relative mt-2 h-2 rounded-full ${measured ? "bg-[var(--m-rule)]" : "border border-dashed border-[var(--m-soft)]"}`}
    >
      {measured && <div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${Math.max(2, Math.min(100, row.level!))}%` }} />}
      {row.target !== null && <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded bg-[var(--m-ink)]" style={{ left: `${Math.min(100, row.target)}%` }} />}
    </div>
  );
}

function Row({ row }: { row: MatrixRow }) {
  const note = [
    row.arenaPasses > 0 ? `${row.arenaPasses} Arena pass${row.arenaPasses === 1 ? "" : "es"}` : null,
    row.target !== null ? (row.gap === 0 ? `target ${row.target} met` : row.gap !== null ? `${row.gap} to reach the target of ${row.target}` : `target ${row.target}`) : null,
  ].filter(Boolean).join(" · ");
  const wantsPractice = row.practise && (row.level === null || (row.gap ?? 0) > 0);
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold text-[var(--m-ink)]">
          <span className="truncate">{row.name}</span>
          {row.verified && <BadgeCheck size={14} className="shrink-0 text-[var(--m-accent)]" aria-label="Verified by evidence" />}
        </span>
        <span className="shrink-0 text-[12.5px] font-semibold text-[var(--m-muted)]">
          {row.label}
          {row.level !== null && <span className="ml-1.5 font-lp-display text-[15px] font-bold text-[var(--m-ink)]">{Math.round(row.level)}</span>}
        </span>
      </div>
      <Bar row={row} />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-[var(--m-muted)]">
        <span>{note || (row.level === null ? "Nothing measured yet" : "")}</span>
        {wantsPractice && (
          <Link href={`/arena/challenges/domain?focus=${row.practise!.areaKey}`} className="inline-flex items-center gap-1 font-bold text-[var(--m-accent-ink)] hover:underline">
            Practise {row.practise!.areaName} <ArrowRight size={12} aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

/** The user's measured skills as Arena sees them. A skill nobody has measured is shown as "Not assessed" with an empty bar, never as a low score. */
export function SkillMatrix({ rows, level, careerName = null }: { rows: MatrixRow[]; level: ExperienceLevel; careerName?: string | null }) {
  return (
    <section aria-labelledby="matrix-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <h2 id="matrix-h" className="font-lp-display text-[28px] font-bold text-[var(--m-ink)]">Your skill profile</h2>
        <p className="text-[13px] font-semibold text-[var(--m-muted)]">Tickets are matched to your experience: {LEVEL_TEXT[level]}</p>
      </div>
      <p className="mt-1 max-w-2xl font-lp-body text-[13.5px] leading-relaxed text-app-muted">
        {careerName ? `Starting skills for ${careerName}. ` : ""}Measured from your assessments, Arena tickets and projects. Each skill has its own level. The dark tick marks what your target role asks for.
      </p>
      {rows.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-[var(--m-ground)] px-4 py-5 font-lp-body text-[14px] text-[var(--m-muted)]">
          {careerName
            ? `We have not mapped the starting skills for ${careerName} yet. They will appear here as soon as they are.`
            : "Choose your target career and the skills it asks for will appear here, each measured as you practise."}
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
          {rows.map((row) => <Row key={row.skillId} row={row} />)}
        </ul>
      )}
    </section>
  );
}
