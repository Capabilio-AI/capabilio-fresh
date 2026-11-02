import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { proficiencyBySkill, type AreaSkillLink, type Completion, type SkillProficiency } from "./by-skill";

/**
 * A student's proficiency per skill, from their verified Arena passes. Reads with the service client because it is also used for the public portfolio,
 * which is read by someone who is not the student; it returns levels and reasons only, never the work itself.
 */
export async function getSkillProficiency(userId: string): Promise<SkillProficiency[]> {
  const db = untyped(createServiceClient());
  const { data: done } = await db.from("arena_attempt_completions").select("attempt_id, role_key, skill_area_key, challenge_id").eq("user_id", userId);
  const completions: Completion[] = ((done ?? []) as { attempt_id: string; role_key: string; skill_area_key: string; challenge_id: string }[]).map((c) => ({ attemptId: c.attempt_id, roleKey: c.role_key, areaKey: c.skill_area_key, challengeId: c.challenge_id }));
  if (completions.length === 0) return [];

  const attemptIds = completions.map((c) => c.attemptId);
  const challengeIds = [...new Set(completions.map((c) => c.challengeId))];
  const roleKeys = [...new Set(completions.map((c) => c.roleKey))];
  const [challenges, attempts, interviews, areas, extras] = await Promise.all([
    db.from("arena_challenges").select("id, difficulty").in("id", challengeIds),
    db.from("arena_domain_assignments").select("id, submission_count").in("id", attemptIds),
    db.from("arena_task_interviews").select("attempt_id").in("attempt_id", attemptIds).eq("passed", true),
    db.from("arena_skill_areas").select("role_key, area_key, skill_id").in("role_key", roleKeys).not("skill_id", "is", null),
    db.from("arena_area_extra_skills").select("role_key, area_key, skill_id").in("role_key", roleKeys),
  ]);
  const links: AreaSkillLink[] = [...((areas.data ?? []) as { role_key: string; area_key: string; skill_id: string }[]), ...((extras.data ?? []) as { role_key: string; area_key: string; skill_id: string }[])].map((l) => ({ roleKey: l.role_key, areaKey: l.area_key, skillId: l.skill_id }));
  const skillIds = [...new Set(links.map((l) => l.skillId))];
  const { data: skills } = skillIds.length ? await db.from("skills").select("id, name").in("id", skillIds) : { data: [] };

  return proficiencyBySkill({
    completions,
    difficultyByChallenge: Object.fromEntries(((challenges.data ?? []) as { id: string; difficulty: string }[]).map((c) => [c.id, c.difficulty])),
    submissionsByAttempt: Object.fromEntries(((attempts.data ?? []) as { id: string; submission_count: number }[]).map((a) => [a.id, a.submission_count])),
    explainedAttempts: new Set(((interviews.data ?? []) as { attempt_id: string }[]).map((i) => i.attempt_id)),
    links,
    skillNames: Object.fromEntries(((skills ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name])),
  });
}
