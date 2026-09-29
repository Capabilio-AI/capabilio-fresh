import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listEnabledRoles, loadRoleTaxonomy, matchRoleForStatedCareer } from "@/lib/arena-workstations/taxonomy";

const BASELINE_RATING = 400;
const MAX_ASSESSMENT_RATING = 700;

/**
 * Runs once, right after the onboarding assessment completes. Every Arena
 * skill-area rating otherwise starts flat at 400 (arena_skill_ratings'
 * column default) the moment a student first completes a task in that
 * area — this pre-seeds those rows from the assessment's average
 * capability_score instead, so a stronger assessment shows up as a head
 * start rather than everyone looking identical on day one.
 *
 * The question bank tests general aptitude (quantitative, logical,
 * programming fundamentals, ...), not the specific Arena skill areas
 * (SQL, statistics, ...) — there's no per-skill mapping to draw on yet,
 * so this applies one aptitude-derived rating uniformly across the
 * student's matched role's areas. `onConflict` + `ignoreDuplicates` means
 * a student who has already done real Arena work (earned a real rating)
 * is never overwritten by this.
 */
export async function seedArenaRatingFromAssessment(service: SupabaseClient<Database>, userId: string, statedRole: string | null): Promise<void> {
  const { data: capabilities } = await service.from("capabilities").select("capability_score").eq("user_id", userId);
  const scores = (capabilities ?? []).map((c) => c.capability_score);
  if (scores.length === 0) return;

  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const rating = Math.min(MAX_ASSESSMENT_RATING, Math.round(BASELINE_RATING + avgScore * 3));

  const roles = await listEnabledRoles(service);
  const role = matchRoleForStatedCareer(roles, statedRole) ?? roles[0];
  if (!role) return;

  const { areas } = await loadRoleTaxonomy(service, role.role_key);
  if (areas.length === 0) return;

  await service
    .from("arena_skill_ratings")
    .upsert(
      areas.map((a) => ({ user_id: userId, role_key: role.role_key, area_key: a.area_key, rating })),
      { onConflict: "user_id,role_key,area_key", ignoreDuplicates: true }
    );
}
