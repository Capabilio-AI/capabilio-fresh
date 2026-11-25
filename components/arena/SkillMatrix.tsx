import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import type { MatrixRow } from "@/lib/capability/matrix";
import type { ExperienceLevel } from "@/lib/workplace/level";
import { MASTERY_PROOFS, POINTS_PER_PROOF } from "@/lib/roadmap-visual/capability";

const LEVEL_TEXT: Record<ExperienceLevel, string> = { fresher: "Fresher", junior: "Junior", mid: "Mid-level", senior: "Senior", expert: "Expert" };

function Bar({ row }: { row: MatrixRow }) {
  const measured = row.level !== null;
  return (
    <div
      role="img"
      aria-label={measured ? `${row.name}: level ${Math.round(row.level!)} of 100${row.target !== null ? `, target ${row.target}` : ""}` : `${row.name}: not assessed`}
      className={`relative mt-2 h-2 rounded-full ${measured ? "bg-[var(--m-rule)]" : "border border-dashed border-[var(--m-soft)]"}`}
    >
      {measured && <div className={`h-full rounded-full ${row.lastResult === "failed" ? "bg-app-rose" : row.lastResult === "passed" ? "bg-app-success" : "bg-[var(--m-muted)]"}`} style={{ width: `${Math.max(2, Math.min(100, row.level!))}%` }} />}
      {row.target !== null && <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded bg-[var(--m-ink)]" style={{ left: `${Math.min(100, row.target)}%` }} />}
    </div>
  );
}

function Row({ row }: { row: MatrixRow }) {
  const note = [
    row.lastResult === "failed" ? "last ticket not passed" : row.lastResult === "passed" ? "last ticket passed" : null,
    row.verified && row.evidenceCount > 0 ? `${row.evidenceCount} of ${MASTERY_PROOFS} proofs` : null,
    row.target !== null ? (row.gap === 0 ? `target ${row.target} met` : row.gap !== null ? `about ${Math.ceil(row.gap / POINTS_PER_PROOF)} more proofs to reach the target of ${row.target}` : `target ${row.target}`) : null,
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
        <span className={row.lastResult === "failed" ? "text-app-rose" : row.lastResult === "passed" ? "text-app-success" : undefined}>{note || (row.level === null ? "Nothing measured yet" : "")}</span>
        {wantsPractice && (
          <Link href={`/arena/challenges/domain?focus=${row.practise!.areaKey}`} className="inline-flex items-center gap-1 font-bold text-[var(--m-accent-ink)] hover:underline">
            Practise {row.practise!.areaName} <ArrowRight size={12} aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

/** Pure. Where the student stands, in plain numbers: skills with a first proof, proofs in all, and the one skill to prove next. */
export function standing(rows: MatrixRow[]) {
  const started = rows.filter((r) => r.level !== null && r.verified);
  const proofs = started.reduce((n, r) => n + r.evidenceCount, 0);
  const next = [...rows].filter((r) => r.practise).sort((a, b) => (a.evidenceCount - b.evidenceCount) || ((b.target ?? 0) - (a.target ?? 0)))[0] ?? null;
  return { skills: rows.length, started: started.length, proofs, next };
}

function Standing({ rows }: { rows: MatrixRow[] }) {
  const s = standing(rows);
  return (
    <div className="mt-4 rounded-2xl bg-[var(--m-ground)] p-4">
      <p className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Where you stand</p>
      <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-[var(--m-muted)]">
        {s.proofs === 0 ? "Nothing is proven yet. " : `${s.started} of ${s.skills} skills have a first proof, ${s.proofs} proofs in all. `}
        A level here is how deeply a skill is proven, not how well one test went: each proof adds about {POINTS_PER_PROOF} points, about {MASTERY_PROOFS} proofs make a full skill, and 100 is for a verified interview with a live challenge. A first proof shows as {POINTS_PER_PROOF}, and that is honest.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 text-[13px] font-bold">
        <li><Link href="/skillstudio" className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[var(--m-ink)]">Learn it in SkillStudio <ArrowRight size={12} aria-hidden /></Link></li>
        <li><Link href="/dashboard/roadmap" className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[var(--m-ink)]">Build a project <ArrowRight size={12} aria-hidden /></Link></li>
        {s.next?.practise && <li><Link href={`/arena/challenges/domain?focus=${s.next.practise.areaKey}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--m-ink)] px-3.5 py-1.5 text-white">Prove {s.next.name} next <ArrowRight size={12} aria-hidden /></Link></li>}
        <li><Link href="/dashboard/portfolio" className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[var(--m-ink)]">See your portfolio <ArrowRight size={12} aria-hidden /></Link></li>
      </ul>
    </div>
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
      {rows.length > 0 && <Standing rows={rows} />}
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
