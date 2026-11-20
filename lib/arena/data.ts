import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { mainRoleRatings } from "./leaderboard-rules";

export interface LeaderboardEntry {
  userId: string;
  name: string | null;
  rating: number;
  rank: number;
  isViewer: boolean;
}

const LEADERBOARD_LIMIT = 50;
// ponytail: reads up to this many ledger and intent rows in one go; paginate or move the ranking into SQL if the student count passes it
const ROW_LIMIT = 5000;

/**
 * Global rank by the one career ELO ledger (student_career_elo), using each student's main role, so Arena shows the same rating as the dashboard
 * and portfolio. Ratings on other roles (an earlier role, a Plan B) do not count. The ledger is not publicly readable, so the aggregate read uses the service client.
 */
export async function getLeaderboard(
  supabase: SupabaseClient<Database>,
  viewerId: string
): Promise<LeaderboardEntry[]> {
  const service = untyped(createServiceClient());
  const [{ data: ledger, error: ratingsError }, { data: intents, error: intentError }] = await Promise.all([
    service.from("student_career_elo").select("student_id, career_id, rating").limit(ROW_LIMIT),
    service.from("student_career_intent").select("student_id, primary_career_id").not("primary_career_id", "is", null).limit(ROW_LIMIT),
  ]);
  if (ratingsError) throw ratingsError;
  if (intentError) throw intentError;
  const primaryByStudent = new Map(((intents ?? []) as { student_id: string; primary_career_id: string }[]).map((i) => [i.student_id, i.primary_career_id]));
  const ratings = mainRoleRatings((ledger ?? []) as { student_id: string; career_id: string; rating: number }[], primaryByStudent)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, LEADERBOARD_LIMIT);
  if (ratings.length === 0) return [];

  const { data: authors, error: authorsError } = await supabase.rpc("get_public_profiles", {
    p_ids: ratings.map((r) => r.user_id),
  });
  if (authorsError) throw authorsError;
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  return ratings.map((r, i) => ({
    userId: r.user_id,
    name: nameById.get(r.user_id) ?? null,
    rating: r.rating,
    rank: i + 1,
    isViewer: r.user_id === viewerId,
  }));
}
