import type { Difficulty } from "./select-stream";

export const DOMAIN_SET_SIZE = 8;

export interface DomainCandidate {
  id: string;
  difficulty: string;
  skillIds: string[];
}

export interface SkillGap {
  skillId: string;
  skillName: string;
  /** effective level 0-100; 0 when the student has no recorded evidence */
  current: number;
  hasData: boolean;
  target: number;
  /** CRITICAL | HIGH | MEDIUM | LOW */
  importance: string;
}

export interface DomainReason {
  skillId: string;
  skillName: string;
  current: number;
  hasData: boolean;
  target: number;
}

export interface DomainPick {
  id: string;
  /** null when the challenge is linked to the career but to no skill the student currently has a gap in */
  reason: DomainReason | null;
}

const IMPORTANCE_WEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const rankOf = (d: string) => Math.max(0, DIFFICULTIES.indexOf(d as Difficulty));

/** Difficulty suited to where the student is on a skill (0-100). Career-level ELO does not exist yet, so real skill level is used. */
export function difficultyForLevel(level: number): Difficulty {
  if (level < 34) return "easy";
  if (level < 67) return "medium";
  return "hard";
}

const gapSize = (g: SkillGap) => Math.max(0, g.target - g.current);

/**
 * Pure. Of a career's PUBLISHED, unsolved challenges, choose DOMAIN_SET_SIZE that address the student's largest skill gaps for that career
 * (weighted by how important the skill is), at a difficulty that fits their level in that skill, no more than two per skill while
 * other gapped skills still have challenges. Returned foundational -> advanced. Fewer than the set size is returned as-is.
 */
export function selectDomainSet(pool: DomainCandidate[], solvedIds: ReadonlySet<string>, gaps: SkillGap[], size = DOMAIN_SET_SIZE): DomainPick[] {
  const gapBySkill = new Map(gaps.filter((g) => gapSize(g) > 0).map((g) => [g.skillId, g]));

  const scored = pool
    .filter((c) => !solvedIds.has(c.id))
    .map((c) => {
      const options = c.skillIds.flatMap((id) => (gapBySkill.has(id) ? [gapBySkill.get(id)!] : []));
      // the challenge's most valuable gap skill, preferring one whose level matches this challenge's difficulty
      const scoredOptions = options.map((g) => {
        const fit = 1 - Math.min(2, Math.abs(rankOf(c.difficulty) - rankOf(difficultyForLevel(g.current)))) * 0.35;
        return { g, value: gapSize(g) * (IMPORTANCE_WEIGHT[g.importance] ?? 1) * fit };
      });
      const best = scoredOptions.sort((a, b) => b.value - a.value || a.g.skillName.localeCompare(b.g.skillName))[0];
      return { c, skillId: best?.g.skillId ?? null, value: best?.value ?? 0, gap: best?.g ?? null };
    })
    .sort((a, b) => b.value - a.value || a.c.id.localeCompare(b.c.id));

  const chosen: typeof scored = [];
  const perSkill = new Map<string, number>();
  const remaining = [...scored];
  while (chosen.length < size && remaining.length > 0) {
    // spread: skip a skill that already has two while some other candidate is still available
    const idx = remaining.findIndex((r) => r.skillId === null || (perSkill.get(r.skillId) ?? 0) < 2);
    const pick = remaining.splice(idx === -1 ? 0 : idx, 1)[0];
    chosen.push(pick);
    if (pick.skillId) perSkill.set(pick.skillId, (perSkill.get(pick.skillId) ?? 0) + 1);
  }

  return chosen
    .sort((a, b) => rankOf(a.c.difficulty) - rankOf(b.c.difficulty) || b.value - a.value || a.c.id.localeCompare(b.c.id))
    .map((r) => ({
      id: r.c.id,
      reason: r.gap ? { skillId: r.gap.skillId, skillName: r.gap.skillName, current: r.gap.current, hasData: r.gap.hasData, target: r.gap.target } : null,
    }));
}

/** Pure. Plain-language "why this one", from the real numbers only. */
export function explainPick(reason: DomainReason | null, careerName: string): string {
  if (!reason) return `Part of the ${careerName} track.`;
  return reason.hasData
    ? `Recommended because your ${reason.skillName} is ${reason.current} and the target is ${reason.target}.`
    : `Recommended because ${reason.skillName} has no recorded score yet and the target is ${reason.target}.`;
}

export interface SkillRecommendationInput {
  pool: (DomainCandidate & { careerIds: string[] })[];
  solvedIds: ReadonlySet<string>;
  skillId: string;
  careerId: string | null;
  /** the student's current level in the skill; null when unknown */
  level: number | null;
  limit?: number;
}

/** Pure. "Recommended challenges for skill X (and career Y)" for the Roadmap page: tagged with the skill, unsolved, career-linked first, closest difficulty to the student's level. */
export function recommendForSkill(input: SkillRecommendationInput): string[] {
  const want = rankOf(difficultyForLevel(input.level ?? 0));
  return input.pool
    .filter((c) => c.skillIds.includes(input.skillId) && !input.solvedIds.has(c.id))
    .sort(
      (a, b) =>
        Number(input.careerId !== null && b.careerIds.includes(input.careerId)) - Number(input.careerId !== null && a.careerIds.includes(input.careerId)) ||
        Math.abs(rankOf(a.difficulty) - want) - Math.abs(rankOf(b.difficulty) - want) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, input.limit ?? 5)
    .map((c) => c.id);
}
