import { assessProficiency, type Difficulty, type Proficiency, type ProofPoint } from "./levels";

export interface Completion {
  attemptId: string;
  roleKey: string;
  areaKey: string;
  challengeId: string;
}
/** Which skills an Arena area proves: its primary skill plus any extras (arena_skill_areas.skill_id and arena_area_extra_skills). */
export interface AreaSkillLink {
  roleKey: string;
  areaKey: string;
  skillId: string;
}

export interface SkillProficiency {
  skillId: string;
  skillName: string;
  roleKey: string;
  proficiency: Proficiency;
}

const asDifficulty = (v: string | undefined): Difficulty => (v === "hard" ? "hard" : v === "medium" ? "medium" : "easy");

/**
 * Pure. Turns verified completions into one proficiency per skill. A pass counts toward every skill its area proves. `areaCount` for a skill is how many
 * areas of the role can prove it, which decides whether "work in two different areas" is a fair thing to ask. Skills with no pass are left out: a level
 * is shown only when there is work behind it.
 */
export function proficiencyBySkill(input: {
  completions: Completion[];
  difficultyByChallenge: Record<string, string>;
  submissionsByAttempt: Record<string, number>;
  explainedAttempts: ReadonlySet<string>;
  links: AreaSkillLink[];
  skillNames: Record<string, string>;
}): SkillProficiency[] {
  const out: SkillProficiency[] = [];
  const keys = new Set(input.links.map((l) => `${l.roleKey}::${l.skillId}`));
  for (const key of keys) {
    const [roleKey, skillId] = key.split("::");
    const areas = new Set(input.links.filter((l) => l.roleKey === roleKey && l.skillId === skillId).map((l) => l.areaKey));
    const points: ProofPoint[] = input.completions
      .filter((c) => c.roleKey === roleKey && areas.has(c.areaKey))
      .map((c) => ({
        attemptId: c.attemptId,
        areaKey: c.areaKey,
        difficulty: asDifficulty(input.difficultyByChallenge[c.challengeId]),
        submissions: Math.max(1, input.submissionsByAttempt[c.attemptId] ?? 1),
        explained: input.explainedAttempts.has(c.attemptId),
      }));
    if (points.length === 0) continue;
    out.push({ skillId, skillName: input.skillNames[skillId] ?? skillId, roleKey, proficiency: assessProficiency(points, areas.size) });
  }
  return out.sort((a, b) => b.proficiency.level - a.proficiency.level || b.proficiency.passes - a.proficiency.passes || a.skillName.localeCompare(b.skillName));
}
