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

export async function getLeaderboard(
  supabase: SupabaseClient<Database>,
  viewerId: string
): Promise<LeaderboardEntry[]> {
  const { data: ratings, error: ratingsError } = await supabase
    .from("arena_ratings")
    .select("user_id, rating")
    .order("rating", { ascending: false })
    .limit(LEADERBOARD_LIMIT);
  if (ratingsError) throw ratingsError;
  if (!ratings || ratings.length === 0) return [];

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
