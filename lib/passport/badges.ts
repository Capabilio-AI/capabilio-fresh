import type { SkillResult } from "@/lib/assess/scoring";

// A badge is recognition of a measured skill, never a self-claim: it needs a score and enough evidence to trust it.
export const BADGE_LEVELS = ["Foundation", "Proficient", "Advanced"] as const;
export type BadgeLevel = (typeof BADGE_LEVELS)[number];

const FOUNDATION_FROM = 40;
const PROFICIENT_FROM = 60;
const ADVANCED_FROM = 80;

export function badgeLevel(score: number | null, confidence: SkillResult["confidence"]): BadgeLevel | null {
  if (score === null || confidence === "INSUFFICIENT" || score < FOUNDATION_FROM) return null;
  return score >= ADVANCED_FROM ? "Advanced" : score >= PROFICIENT_FROM ? "Proficient" : "Foundation";
}

export interface Badge {
  skillId: string;
  name: string;
  level: BadgeLevel;
  /** low-confidence evidence still earns the badge, but it is shown as provisional */
  provisional: boolean;
  evidenceCount: number;
}
export interface PassportSkill {
  skillId: string;
  name: string;
  badge: Badge | null;
  /** why there is no badge yet, in the student's words */
  status: "earned" | "building" | "not-assessed";
}

export function passportSkills(skills: readonly SkillResult[]): PassportSkill[] {
  const rank = (s: PassportSkill) => (s.badge ? BADGE_LEVELS.indexOf(s.badge.level) + 1 : 0);
  return skills
    .map((s): PassportSkill => {
      const level = badgeLevel(s.score, s.confidence);
      if (level) return { skillId: s.skillId, name: s.name, status: "earned", badge: { skillId: s.skillId, name: s.name, level, provisional: s.confidence === "LOW", evidenceCount: s.evidenceCount } };
      return { skillId: s.skillId, name: s.name, badge: null, status: s.score === null || s.confidence === "INSUFFICIENT" ? "not-assessed" : "building" };
    })
    .sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name));
}
