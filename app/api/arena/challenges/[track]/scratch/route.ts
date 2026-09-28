import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { isChallengeTrack, resolveTrackScope } from "@/lib/arena-challenges/resolve-scope";
import { ensureChallengePool } from "@/lib/arena-challenges/generate";
import { pickWeeklyBatch } from "@/lib/arena-challenges/batch-select";
import { currentWeekStart, weekStartOf } from "@/lib/arena-challenges/week";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reveals this week's already-spun batch. Tries to top up the catalog via
 * AI first, but never blocks the reveal on that failing -- if generation
 * errors (rate limit, provider outage, etc.), this proceeds with whatever
 * is already stored in arena_challenges for the scope. Only a genuinely
 * empty pool (first-ever request for a scope, generation also failing)
 * produces an honest "not ready yet" error instead of a fake reveal.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ track: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_challenge_scratch", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { track } = await params;
  if (!isChallengeTrack(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 404 });
  }

  const scope = await resolveTrackScope(supabase, auth.userId, track);
  if (!scope) {
    return NextResponse.json({ error: "No branch/career on record." }, { status: 409 });
  }

  const service = createServiceClient();
  const { data: week } = await service
    .from("arena_challenge_weeks")
    .select("id, status, task_count")
    .eq("user_id", auth.userId)
    .eq("track", track)
    .eq("week_start", currentWeekStart())
    .maybeSingle();

  if (!week) {
    return NextResponse.json({ error: "Spin the wheel first." }, { status: 409 });
  }
  if (week.status === "revealed") {
    return NextResponse.json({ error: "This week is already revealed." }, { status: 409 });
  }

  try {
    await ensureChallengePool(service, track, scope.scopeKey, scope.promptLabel);
  } catch (generationError) {
    console.error("[arena/challenges/scratch] AI generation failed, falling back to the stored pool:", generationError);
  }

  const { data: pool } = await service.from("arena_challenges").select("id").eq("track", track).eq("scope_key", scope.scopeKey).eq("active", true);
  if (!pool || pool.length === 0) {
    return NextResponse.json({ error: "No challenges available for this scope yet — try again shortly." }, { status: 503 });
  }

  const previousWeekStart = weekStartOf(new Date(Date.now() - 7 * DAY_MS));
  const { data: previousWeek } = await service
    .from("arena_challenge_weeks")
    .select("challenge_ids")
    .eq("user_id", auth.userId)
    .eq("track", track)
    .eq("week_start", previousWeekStart)
    .maybeSingle();

  const challengeIds = pickWeeklyBatch(pool, week.task_count, previousWeek?.challenge_ids ?? []);

  const { error } = await service
    .from("arena_challenge_weeks")
    .update({ status: "revealed", challenge_ids: challengeIds, revealed_at: new Date().toISOString() })
    .eq("id", week.id);
  if (error) {
    return NextResponse.json({ error: "Could not reveal this week's challenges." }, { status: 500 });
  }

  const { data: challenges } = await service
    .from("arena_challenges")
    .select("id, title, category, difficulty, time_limit_minutes, scenario, objective, language, starter_code, stdin, skill_tags")
    .in("id", challengeIds);

  return NextResponse.json({ challenges: challenges ?? [] });
}
