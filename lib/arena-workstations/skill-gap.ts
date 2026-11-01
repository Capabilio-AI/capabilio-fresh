// Which skill area should the next Arena task come from? The one that closes the biggest gap to the role: sum of weight x (target - score) over
// the skills the area proves, an unproven skill counting as score 0. The rotation serves the LOWEST value first, so priorities are negative need.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCareerSkills, type Db } from "@/lib/assess/db";

export interface SkillNeed { weight: number; target: number; score: number | null }
export interface AreaSkills { areaKey: string; skillIds: readonly string[] }

/** Pure. The gap an area could close; 0 for an area that proves no known skill. */
export function areaNeed(skillIds: readonly string[], skills: ReadonlyMap<string, SkillNeed>): number {
  return [...new Set(skillIds)].reduce((sum, id) => {
    const s = skills.get(id);
    return s ? sum + s.weight * Math.max(0, s.target - (s.score ?? 0)) : sum;
  }, 0);
}

/** Pure. Rotation priorities (lowest served first); undefined when no area proves a known skill, so the caller keeps its rating-based order. */
export function priorityByNeed(areas: readonly AreaSkills[], skills: ReadonlyMap<string, SkillNeed>): Record<string, number> | undefined {
  if (!areas.some((a) => a.skillIds.some((id) => skills.has(id)))) return undefined;
  return Object.fromEntries(areas.map((a) => [a.areaKey, 0 - areaNeed(a.skillIds, skills)]));
}

/** The student's rotation priorities for a role from their skill graph, or undefined when the role has no skill list or no linked areas yet. */
export async function skillGapPriorities(service: SupabaseClient, userId: string, roleKey: string): Promise<Record<string, number> | undefined> {
  const db = service as unknown as Db;
  const { data: career } = await db.from("careers").select("id").eq("key", roleKey).maybeSingle();
  if (!career) return undefined;
  const [roleSkills, { data: scores }, { data: areaRows }, { data: extraRows }] = await Promise.all([
    loadCareerSkills(db, career.id),
    db.from("student_skill_scores").select("skill_id, score").eq("student_id", userId),
    db.from("arena_skill_areas").select("area_key, skill_id").eq("role_key", roleKey).eq("enabled", true),
    db.from("arena_area_extra_skills").select("area_key, skill_id").eq("role_key", roleKey), // absent until migration 149 is applied: reads as no rows
  ]);
  const scoreOf = new Map(((scores ?? []) as { skill_id: string; score: number | null }[]).map((s) => [s.skill_id, s.score]));
  const skills = new Map(roleSkills.map((s) => [s.skillId, { weight: s.weight, target: s.targetLevel, score: scoreOf.get(s.skillId) ?? null }]));
  const byArea = new Map<string, string[]>();
  for (const r of [...(areaRows ?? []), ...(extraRows ?? [])] as { area_key: string; skill_id: string | null }[]) {
    byArea.set(r.area_key, [...(byArea.get(r.area_key) ?? []), ...(r.skill_id ? [r.skill_id] : [])]);
  }
  return priorityByNeed([...byArea].map(([areaKey, skillIds]) => ({ areaKey, skillIds })), skills);
}
