import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface LeaderboardEntry {
  userId: string;
  name: string | null;
  rating: number;
  rank: number;
  isViewer: boolean;
}

const LEADERBOARD_LIMIT = 50;

/**
 * Global rank by the one career ELO ledger (student_career_elo), the same rating the dashboard and portfolio show. A student with
 * ratings on several careers ranks by their highest. The ledger is not publicly readable, so the aggregate read uses the service client.
 */
export async function getLeaderboard(
  supabase: SupabaseClient<Database>,
  viewerId: string
): Promise<LeaderboardEntry[]> {
  const { data: ledger, error: ratingsError } = await untyped(createServiceClient()).from("student_career_elo").select("student_id, rating");
  if (ratingsError) throw ratingsError;
  const best = new Map<string, number>();
  for (const r of (ledger ?? []) as { student_id: string; rating: number }[]) best.set(r.student_id, Math.max(best.get(r.student_id) ?? 0, r.rating));
  const ratings = [...best.entries()]
    .map(([user_id, rating]) => ({ user_id, rating: Math.round(rating) }))
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
