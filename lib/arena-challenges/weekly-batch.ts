import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { currentStreamWeek, weekStartOf } from "./week";
import { ensureChallengePool } from "./generate";
import type { StreamScope } from "./resolve-scope";
import { BATCH_SIZE, selectStreamBatch } from "./select-stream";
import { IT_CLUSTER_SCOPE_KEY } from "./branch-clusters";
import { loadStreamPool, type StreamStudentContext } from "./stream-context";

export interface WeeklyBatch {
  weekStart: string;
  challengeIds: string[];
  /** size minus what could be filled from real published content */
  shortfall: number;
}

const RECENT_WEEKS = 2;

/**
 * One batch of up to `size` (the student's wheel number) challenges per (user, Sunday-IST week), chosen by selectStreamBatch from PUBLISHED content only and then fixed
 * for the week. An empty batch is not frozen: it is re-picked on the next request so newly published challenges appear.
 * ponytail: a week with a short (non-empty) batch stays short until next Sunday; re-pick on publish if that proves annoying.
 */
export async function getOrAssignWeeklyBatch(service: SupabaseClient<Database>, userId: string, scope: StreamScope, student: StreamStudentContext, size: number = BATCH_SIZE): Promise<WeeklyBatch> {
  const weekStart = currentStreamWeek();

  const { data: existing } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
  if (existing && existing.challenge_ids.length > 0) return { weekStart, challengeIds: existing.challenge_ids, shortfall: Math.max(0, size - existing.challenge_ids.length) };
  if (existing) await service.from("arena_stream_weeks").delete().eq("user_id", userId).eq("week_start", weekStart);

  // Best-effort: new AI output is stored as DRAFT for admin review and is never served from here; an outage never blocks the batch.
  try {
    if (scope.scopeKey !== IT_CLUSTER_SCOPE_KEY) await ensureChallengePool(service, scope.scopeKey, scope.promptLabel); // IT is filled by the weekly AI run instead
  } catch (generationError) {
    console.error(`[arena-challenges/weekly-batch] AI top-up failed for ${scope.scopeKey}:`, generationError);
  }

  const since = weekStartOf(new Date(Date.now() - RECENT_WEEKS * 7 * 24 * 60 * 60 * 1000));
  const [pool, { data: completions }, { data: stats }, { data: recentWeeks }] = await Promise.all([
    loadStreamPool(service, scope),
    service.from("arena_challenge_completions").select("challenge_id").eq("user_id", userId).eq("track", "stream").eq("is_correct", true),
    service.from("arena_stream_stats").select("points").eq("user_id", userId).maybeSingle(),
    service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).gte("week_start", since).lt("week_start", weekStart),
  ]);

  const selection = selectStreamBatch({
    pool,
    solvedIds: new Set((completions ?? []).map((c) => c.challenge_id)),
    recentIds: new Set((recentWeeks ?? []).flatMap((w) => w.challenge_ids)),
    courses: student.courses,
    currentYear: student.currentYear,
    points: stats?.points ?? 0,
    year: student.currentYear,
    seed: `${userId}:${weekStart}`,
    size,
  });

  const { error } = await service.from("arena_stream_weeks").insert({ user_id: userId, week_start: weekStart, scope_key: scope.scopeKey, challenge_ids: selection.ids });
  if (!error) return { weekStart, challengeIds: selection.ids, shortfall: selection.shortfall };

  // 23505 = unique violation: a concurrent request (e.g. a second tab) already assigned this week's batch first -- use its result.
  if (error.code !== "23505") throw error;
  const { data: winner, error: refetchError } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", weekStart).single();
  if (refetchError || !winner) throw refetchError ?? new Error("Weekly batch missing after conflict");
  return { weekStart, challengeIds: winner.challenge_ids, shortfall: Math.max(0, size - winner.challenge_ids.length) };
}
