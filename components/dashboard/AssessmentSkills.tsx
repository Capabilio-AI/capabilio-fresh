import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SkillResult } from "@/lib/assess/scoring";

const CONFIDENCE: Record<string, string> = { HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence", INSUFFICIENT: "Not enough answers" };

/** Pure. How many of the role's skills the assessment has measured, and how many are proven by real work. */
export function assessmentSummary(skills: readonly SkillResult[]) {
  return { total: skills.length, asked: skills.filter((s) => s.score !== null).length, proven: skills.filter((s) => s.proof > 0).length };
}

/**
 * The skills the sign-up assessment measured, on their own: where the student started. An assessment shows where to begin and is never proof,
 * so it lives apart from the skill graph and gap analysis, which show what real work has proven.
 */
export function AssessmentSkills({ roleName, skills }: { roleName: string; skills: SkillResult[] }) {
  const s = assessmentSummary(skills);
  return (
    <section aria-labelledby="assess-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6">
      <h2 id="assess-h" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Assessment skills</h2>
      <p className="mt-1 max-w-2xl font-lp-body text-[13.5px] leading-relaxed text-app-muted">
        What the assessment measured for {roleName} when you started. It shows where you begin, not what you have proven: proof builds in Arena, and your skill graph and gap analysis count only that.
      </p>
      <p className="mt-3 text-[13px] font-semibold text-[var(--m-ink)]">{s.asked} of {s.total} skills asked · {s.proven} proven by Arena work</p>
      {skills.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[var(--m-ground)] px-4 py-5 text-[14px] text-[var(--m-muted)]">The skill list for {roleName} is not ready yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
          {skills.map((k) => (
            <li key={k.skillId} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-bold text-[var(--m-ink)]">{k.name}</span>
                <span className="shrink-0 text-[12.5px] font-semibold text-[var(--m-muted)]">{k.score === null ? "Not asked" : <>Assessment <span className="font-lp-display text-[15px] font-bold text-[var(--m-ink)]">{k.score}</span></>}</span>
              </div>
              <div role="img" aria-label={k.score === null ? `${k.name}: not asked in the assessment` : `${k.name}: assessment level ${k.score} of 100`} className={`mt-2 h-2 rounded-full ${k.score === null ? "border border-dashed border-[var(--m-soft)]" : "bg-[var(--m-rule)]"}`}>
                {k.score !== null && <div className="h-full rounded-full bg-[var(--m-muted)]" style={{ width: `${Math.max(2, Math.min(100, k.score))}%` }} />}
              </div>
              <p className="mt-1.5 text-[12px] text-[var(--m-muted)]">
                {k.score === null ? "Asked in a later round" : `${k.evidenceCount} ${k.evidenceCount === 1 ? "answer" : "answers"} · ${CONFIDENCE[k.confidence] ?? k.confidence}`}
                {" · "}{k.proof > 0 ? "proven by Arena work" : "not yet proven"}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link href="/arena/challenges/domain" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white">Prove your skills in Arena <ArrowRight size={14} aria-hidden /></Link>
    </section>
  );
}
