import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { currentWeekStart } from "./week";
import { ensureChallengePool } from "./generate";

const BATCH_SIZE = 8;

export interface WeeklyBatch {
  weekStart: string;
  challengeIds: string[];
}

/** Pure. The pool, oldest first, minus anything this user has ever solved, capped at BATCH_SIZE -- never re-serves a completed challenge. */
export function pickWeeklyChallengeIds(pool: { id: string }[], solvedIds: ReadonlySet<string>): string[] {
  return pool
    .filter((c) => !solvedIds.has(c.id))
    .slice(0, BATCH_SIZE)
    .map((c) => c.id);
}

/**
 * One fresh batch of BATCH_SIZE challenges per (user, Monday week). Once
 * assigned, a week's batch is fixed -- a new week's batch excludes every
 * challenge this user has ever solved, so a completed challenge is never
 * re-served.
 * ponytail: the shared per-scope pool (ensureChallengePool, min 14) caps how
 * many never-solved challenges exist across all weeks; a very active user
 * could outrun top-up before hitting 8 fresh ones (falls back to returning
 * fewer, never blocks). Raise the pool minimum if that's observed in practice.
 */
export async function getOrAssignWeeklyBatch(service: SupabaseClient<Database>, userId: string, scopeKey: string, promptLabel: string): Promise<WeeklyBatch> {
  const weekStart = currentWeekStart();

  const { data: existing } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
  if (existing) return { weekStart, challengeIds: existing.challenge_ids };

  // Best-effort top-up: an outage here never blocks the batch from being
  // assigned with whatever's already stored (see docs/arena-challenges-redesign.md).
  try {
    await ensureChallengePool(service, scopeKey, promptLabel);
  } catch (generationError) {
    console.error(`[arena-challenges/weekly-batch] AI top-up failed for ${scopeKey}, using the stored pool:`, generationError);
  }

  const [{ data: pool }, { data: completions }] = await Promise.all([
    service.from("arena_challenges").select("id").eq("track", "stream").eq("scope_key", scopeKey).eq("active", true).order("created_at"),
    service.from("arena_challenge_completions").select("challenge_id").eq("user_id", userId).eq("track", "stream").eq("is_correct", true),
  ]);
  const solvedIds = new Set((completions ?? []).map((c) => c.challenge_id));
  const challengeIds = pickWeeklyChallengeIds(pool ?? [], solvedIds);

  const { error } = await service.from("arena_stream_weeks").insert({ user_id: userId, week_start: weekStart, scope_key: scopeKey, challenge_ids: challengeIds });
  if (!error) return { weekStart, challengeIds };

  // 23505 = unique violation: a concurrent request (e.g. a second tab) already
  // assigned this week's batch first -- use its result instead of erroring.
  if (error.code !== "23505") throw error;
  const { data: winner, error: refetchError } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", weekStart).single();
  if (refetchError || !winner) throw refetchError ?? new Error("Weekly batch missing after conflict");
  return { weekStart, challengeIds: winner.challenge_ids };
}
