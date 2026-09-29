import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { advanceStreak } from "./streak";
import { currentWeekStart } from "./week";

/** Adds a first-time correct completion to the student's running points/streak (shared by Stream and Domain challenges). */
export async function addChallengePoints(service: SupabaseClient<Database>, userId: string, points: number, nowIso: string): Promise<void> {
  const { data: stats } = await service.from("arena_challenge_stats").select("points, tasks_completed, current_streak, longest_streak, last_completed_week").eq("user_id", userId).maybeSingle();
  const nextStreak = advanceStreak(
    {
      currentStreak: stats?.current_streak ?? 0,
      longestStreak: stats?.longest_streak ?? 0,
      lastCompletedWeek: stats?.last_completed_week ?? null,
    },
    currentWeekStart()
  );
  await service.from("arena_challenge_stats").upsert({
    user_id: userId,
    points: (stats?.points ?? 0) + points,
    tasks_completed: (stats?.tasks_completed ?? 0) + 1,
    current_streak: nextStreak.currentStreak,
    longest_streak: nextStreak.longestStreak,
    last_completed_week: nextStreak.lastCompletedWeek,
    updated_at: nowIso,
  });
}
