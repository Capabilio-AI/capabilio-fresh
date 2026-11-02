import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import type { SkillProficiency } from "./by-skill";
import { assessRoleReadiness, type Importance, type RoleReadiness } from "./readiness";

export interface StudentRoleReadiness extends RoleReadiness {
  careerName: string;
}

/** A student's readiness for their primary target role, from what the role requires and the levels they have shown. Null when they have not chosen a role. */
export async function getRoleReadiness(userId: string, proficiency: SkillProficiency[]): Promise<StudentRoleReadiness | null> {
  const db = untyped(createServiceClient());
  const { data: intent } = await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  const careerId = (intent as { primary_career_id: string | null } | null)?.primary_career_id;
  if (!careerId) return null;
  const [{ data: career }, { data: reqs }] = await Promise.all([
    db.from("careers").select("name").eq("id", careerId).maybeSingle(),
    db.from("career_skill_requirements").select("skill_id, importance").eq("career_id", careerId),
  ]);
  const requirements = (reqs ?? []) as { skill_id: string; importance: Importance }[];
  if (requirements.length === 0) return null;
  const { data: skills } = await db.from("skills").select("id, name").in("id", requirements.map((r) => r.skill_id));
  const nameOf = new Map(((skills ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  const levelBySkill: Record<string, number> = {};
  const nextStepsBySkill: Record<string, string[]> = {};
  for (const p of proficiency) {
    if (p.proficiency.level >= (levelBySkill[p.skillId] ?? 0)) {
      levelBySkill[p.skillId] = p.proficiency.level;
      nextStepsBySkill[p.skillId] = p.proficiency.next?.needs ?? [];
    }
  }
  for (const r of requirements) if (!(r.skill_id in levelBySkill)) nextStepsBySkill[r.skill_id] = ["1 verified task passed"];

  const careerName = (career as { name: string } | null)?.name ?? "this role";
  const result = assessRoleReadiness(
    requirements.map((r) => ({ skillId: r.skill_id, name: nameOf.get(r.skill_id) ?? "Skill", importance: r.importance })),
    levelBySkill,
    nextStepsBySkill,
    careerName
  );
  return { ...result, careerName };
}
