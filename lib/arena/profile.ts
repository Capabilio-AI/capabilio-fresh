import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildSkillMatrix, type MatrixRow } from "@/lib/capability/matrix";
import { loadCareerSkills } from "@/lib/assess/db";
import { getCareerIntent } from "@/lib/careers/intent";
import { chooseDomainCareer } from "@/lib/arena-challenges/career-state";
import { loadExperienceLevel } from "@/lib/workplace/level-server";
import type { ExperienceLevel } from "@/lib/workplace/level";
import { loadSkillContext } from "./skill-context";

export interface ArenaProfile {
  rows: MatrixRow[];
  level: ExperienceLevel;
  /** the career the profile is for; null when the student has not chosen one */
  careerName: string | null;
}

/** A role's skill list is short; this only guards against a runaway one. */
const MAX_ROWS = 30;

/**
 * The user's skill matrix for the Arena home: exactly the skills their chosen career asks for, the same list the role assessment tests
 * (`career_skill_requirements`), each with their measured level. Nothing outside the role appears, however much else they have measured.
 * Without a chosen career there is nothing to measure against.
 */
export async function loadArenaProfile(service: SupabaseClient<Database>, userId: string): Promise<ArenaProfile> {
  const [ctx, level, { intent }] = await Promise.all([loadSkillContext(service, userId), loadExperienceLevel(service, userId), getCareerIntent(service, userId)]);
  const chosen = chooseDomainCareer(intent, "primary");
  if (chosen.state !== "ready") return { rows: [], level, careerName: null };

  const roleSkills = await loadCareerSkills(service, chosen.career.id);
  const targets = new Map(roleSkills.map((s) => [s.skillId, s.targetLevel]));
  const arenaPasses = new Map<string, number>();
  for (const [skillId, inputs] of ctx.capabilities.inputs) arenaPasses.set(skillId, inputs.filter((i) => i.kind === "ARENA").length);
  const rows = buildSkillMatrix({ capabilities: ctx.capabilities.bySkill, arenaPasses, names: ctx.names, practisable: ctx.practisable, targets, only: new Set(targets.keys()), limit: MAX_ROWS });
  return { rows, level, careerName: chosen.career.name };
}
