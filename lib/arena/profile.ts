import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildSkillMatrix, type MatrixRow } from "@/lib/capability/matrix";
import { loadExperienceLevel } from "@/lib/workplace/level-server";
import type { ExperienceLevel } from "@/lib/workplace/level";
import type { SkillGap } from "@/lib/career/skill-gap";
import { loadSkillContext } from "./skill-context";

export interface ArenaProfile {
  rows: MatrixRow[];
  level: ExperienceLevel;
}

/**
 * The user's skill matrix for the Arena home: their measured level per skill, which skills their target role still needs, and where Arena can
 * build each one. `targetGaps` is the requirement list of the role they are closest to (from the existing career match).
 */
export async function loadArenaProfile(service: SupabaseClient<Database>, userId: string, targetGaps: readonly SkillGap[]): Promise<ArenaProfile> {
  const [ctx, level] = await Promise.all([loadSkillContext(service, userId), loadExperienceLevel(service, userId)]);
  const targets = new Map<string, number>();
  for (const g of targetGaps) {
    const id = ctx.resolve(g.skill);
    if (id) targets.set(id, g.required);
  }
  const arenaPasses = new Map<string, number>();
  for (const [skillId, inputs] of ctx.capabilities.inputs) arenaPasses.set(skillId, inputs.filter((i) => i.kind === "ARENA").length);
  const rows = buildSkillMatrix({ capabilities: ctx.capabilities.bySkill, arenaPasses, names: ctx.names, practisable: ctx.practisable, targets });
  return { rows, level };
}
