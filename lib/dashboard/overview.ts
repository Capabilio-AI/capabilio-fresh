// Everything the Overview tab shows, derived from the one career profile (assessment + Arena), so it can never disagree with the
// Skills tab, the ELO card or the portfolio. Pure: no database, no clock.
import type { CareerProfile } from "@/lib/assess/career-profile";
import { getTier, type EloTier } from "@/lib/portfolio/elo";

/** Readiness at which a student counts as job-ready for the role (the same line the gap analysis uses for "Ready"). */
export const JOB_READY_AT = 85;
/** The stations on the way to the goal, as readiness percentages. */
export const MILESTONES = [
  { at: 25, label: "Foundations" },
  { at: 50, label: "Core skills" },
  { at: 70, label: "Role-ready basics" },
  { at: JOB_READY_AT, label: "Job-ready" },
] as const;

export interface OverviewSkill {
  name: string;
  score: number | null;
  target: number;
  /** points still to gain; 0 when at or above target; null when not yet measured */
  gap: number | null;
}

export interface Overview {
  roleName: string;
  elo: number;
  tier: EloTier;
  tierProgress: number;
  nextTier: string | null;
  readiness: number;
  pointsToGoal: number;
  /** the next station not yet reached, for "you are here" */
  nextMilestone: { at: number; label: string } | null;
  measured: number;
  total: number;
  strengths: OverviewSkill[];
  lagging: OverviewSkill[];
  /** the one thing to do next: the biggest weighted gap, or the most important skill still unmeasured */
  next: (OverviewSkill & { reason: "gap" | "measure" }) | null;
}

const asSkill = (k: CareerProfile["skills"][number]): OverviewSkill => ({
  name: k.name,
  score: k.score,
  target: k.targetLevel,
  gap: k.score === null ? null : Math.max(0, k.targetLevel - k.score),
});

export function buildOverview(profile: CareerProfile): Overview | null {
  if (!profile.unlocked || !profile.elo || profile.skills.length === 0) return null;
  const elo = Math.round(profile.elo.rating);
  const tier = getTier(elo);
  const upper = tier.max >= 9999 ? null : ELO_NEXT[tier.label] ?? null;
  const readiness = Math.round(profile.readiness ?? 0);

  const weighted = profile.skills.map((k) => ({ k, s: asSkill(k), pressure: k.weight * Math.max(0, k.targetLevel - (k.score ?? 0)) }));
  const measuredSkills = weighted.filter((w) => w.s.score !== null);
  const lagging = measuredSkills.filter((w) => (w.s.gap ?? 0) > 0).sort((a, b) => b.pressure - a.pressure).slice(0, 3).map((w) => w.s);
  const strengths = [...measuredSkills].sort((a, b) => (b.s.score ?? 0) - (a.s.score ?? 0)).slice(0, 3).map((w) => w.s);

  const topGap = measuredSkills.filter((w) => (w.s.gap ?? 0) > 0).sort((a, b) => b.pressure - a.pressure)[0];
  const topUnmeasured = weighted.filter((w) => w.s.score === null).sort((a, b) => b.k.weight - a.k.weight)[0];
  const next = topGap ? { ...topGap.s, reason: "gap" as const } : topUnmeasured ? { ...topUnmeasured.s, reason: "measure" as const } : null;

  return {
    roleName: profile.role?.name ?? "your role",
    elo,
    tier,
    tierProgress: tier.max >= 9999 ? 100 : Math.round(((elo - tier.min) / (tier.max - tier.min)) * 100),
    nextTier: upper,
    readiness,
    pointsToGoal: Math.max(0, JOB_READY_AT - readiness),
    nextMilestone: MILESTONES.find((m) => readiness < m.at) ?? null,
    measured: measuredSkills.length,
    total: profile.skills.length,
    strengths,
    lagging,
    next,
  };
}

const ELO_NEXT: Record<string, string> = { Rookie: "Apprentice", Apprentice: "Practitioner", Practitioner: "Expert", Expert: "Master", Master: "Elite" };
