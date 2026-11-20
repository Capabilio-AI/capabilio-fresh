import { closedChallengeIds } from "./closed";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { currentStreamWeek } from "./week";
import type { StreamScope } from "./resolve-scope";
import { BATCH_SIZE, IT_KIND_CAPS, selectStreamBatch } from "./select-stream";
import { IT_CLUSTER_SCOPE_KEY } from "./branch-clusters";
import { loadStreamPool, type StreamStudentContext } from "./stream-context";

/** The concepts (categories) of challenges the student was served before; ids are read in chunks to keep the request small. */
async function conceptsOf(service: SupabaseClient<Database>, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data } = await service.from("arena_challenges").select("category").in("id", ids.slice(i, i + ID_CHUNK));
    for (const r of data ?? []) out.add(r.category);
  }
  return out;
}

export interface WeeklyBatch {
  weekStart: string;
  challengeIds: string[];
  /** size minus what could be filled from real published content */
  shortfall: number;
}

const ID_CHUNK = 100;

/**
 * One batch of up to `size` (the student's wheel number) challenges per (user, Sunday-IST week), chosen by selectStreamBatch from PUBLISHED content only and then fixed
 * for the week. An empty batch is not frozen: it is re-picked on the next request so newly published challenges appear.
 * ponytail: a week with a short (non-empty) batch stays short until next Sunday; re-pick on publish if that proves annoying.
 */
export async function getOrAssignWeeklyBatch(service: SupabaseClient<Database>, userId: string, scope: StreamScope, student: StreamStudentContext, size: number = BATCH_SIZE): Promise<WeeklyBatch> {
  const weekStart = currentStreamWeek();

  const { data: existing } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
  if (existing && existing.challenge_ids.length > 0) {
    // a board is kept only while every challenge in it still belongs to this student's stream; one written before a content bug was fixed is re-drawn
    const pool = await loadStreamPool(service, scope, userId);
    const allowed = new Set(pool.map((c) => c.id));
    if (existing.challenge_ids.every((id) => allowed.has(id))) return { weekStart, challengeIds: existing.challenge_ids, shortfall: Math.max(0, size - existing.challenge_ids.length) };
  }
  if (existing) await service.from("arena_stream_weeks").delete().eq("user_id", userId).eq("week_start", weekStart);

  const [pool, { data: completions }, { data: stats }, { data: pastWeeks }] = await Promise.all([
    loadStreamPool(service, scope, userId),
    closedChallengeIds(service, userId).then((ids) => ({ data: [...ids].map((challenge_id) => ({ challenge_id })) })),
    service.from("arena_stream_stats").select("points").eq("user_id", userId).maybeSingle(),
    // every earlier week, not just the last two: a challenge the student was ever served ranks behind everything new
    service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).lt("week_start", weekStart),
  ]);
  const servedIds = [...new Set((pastWeeks ?? []).flatMap((w) => w.challenge_ids))];
  const seenConcepts = await conceptsOf(service, servedIds);

  const selection = selectStreamBatch({
    pool,
    solvedIds: new Set((completions ?? []).map((c) => c.challenge_id)),
    recentIds: new Set(servedIds),
    seenConcepts,
    courses: student.courses,
    currentYear: student.currentYear,
    points: stats?.points ?? 0,
    year: student.currentYear,
    seed: `${userId}:${weekStart}`,
    size,
    kindCaps: scope.scopeKey === IT_CLUSTER_SCOPE_KEY ? IT_KIND_CAPS(size) : undefined,
  });

  const { error } = await service.from("arena_stream_weeks").insert({ user_id: userId, week_start: weekStart, scope_key: scope.scopeKey, challenge_ids: selection.ids });
  if (!error) return { weekStart, challengeIds: selection.ids, shortfall: selection.shortfall };

  // 23505 = unique violation: a concurrent request (e.g. a second tab) already assigned this week's batch first -- use its result.
  if (error.code !== "23505") throw error;
  const { data: winner, error: refetchError } = await service.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", weekStart).single();
  if (refetchError || !winner) throw refetchError ?? new Error("Weekly batch missing after conflict");
  return { weekStart, challengeIds: winner.challenge_ids, shortfall: Math.max(0, size - winner.challenge_ids.length) };
}
