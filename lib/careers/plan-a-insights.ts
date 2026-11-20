import type { CareerProfile } from "@/lib/assess/career-profile";

const IMPORTANCE_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SHOWN = 5;

export interface PlanAInsights {
  role: string;
  /** false when the student never took the role's assessment: the screen then says so instead of showing zeros */
  hasAssessment: boolean;
  rating: number | null;
  readiness: number | null;
  proven: number | null;
  coverage: number | null;
  measuredSkills: number;
  totalSkills: number;
  strongest: { name: string; score: number }[];
  /** the role's skills that are weakest or unmeasured, most important first */
  gaps: { name: string; importance: string; score: number | null }[];
  common: { label: string; score: number }[];
}

/**
 * Pure. Everything the student sees about their current (Plan A) role before agreeing to leave it, taken from the same career profile the
 * dashboard shows, so the two can never disagree. Null when there is no main role to summarise.
 */
export function planAInsights(profile: CareerProfile): PlanAInsights | null {
  if (!profile.role) return null;
  const measured = profile.skills.filter((s): s is typeof s & { score: number } => s.score !== null);
  const strongest = [...measured].sort((a, b) => b.score - a.score).slice(0, SHOWN).map((s) => ({ name: s.name, score: Math.round(s.score) }));
  const gaps = profile.skills
    .filter((s) => s.score === null || s.score < s.targetLevel)
    .sort((a, b) => (IMPORTANCE_RANK[a.importance] ?? 9) - (IMPORTANCE_RANK[b.importance] ?? 9) || (a.score ?? -1) - (b.score ?? -1))
    .slice(0, SHOWN)
    .map((s) => ({ name: s.name, importance: s.importance, score: s.score === null ? null : Math.round(s.score) }));
  return {
    role: profile.role.name,
    hasAssessment: profile.elo !== null,
    rating: profile.elo?.rating ?? null,
    readiness: profile.readiness,
    proven: profile.proven,
    coverage: profile.coverage,
    measuredSkills: measured.length,
    totalSkills: profile.skills.length,
    strongest,
    gaps,
    common: (profile.common ?? []).flatMap((c) => (c.score === null ? [] : [{ label: c.label, score: Math.round(c.score) }])),
  };
}
