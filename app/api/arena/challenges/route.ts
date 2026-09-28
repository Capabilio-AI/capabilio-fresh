import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { resolveTrackScope, type ChallengeTrack } from "@/lib/arena-challenges/resolve-scope";
import { ensureChallengePool } from "@/lib/arena-challenges/generate";
import { recommendNextChallenge } from "@/lib/arena-challenges/recommend-next";

async function loadTrackState(service: ReturnType<typeof createServiceClient>, userId: string, track: ChallengeTrack, scope: { scopeKey: string; promptLabel: string } | null) {
  if (!scope) return { scopeKey: null, scopeLabel: null, challenges: [], nextChallengeId: null };

  // Best-effort top-up: a real backend outage here never blocks the grid
  // from loading with whatever's already stored (see docs/arena-challenges-redesign.md).
  try {
    await ensureChallengePool(service, track, scope.scopeKey, scope.promptLabel);
  } catch (generationError) {
    console.error(`[arena/challenges] AI generation failed for ${track}/${scope.scopeKey}, using the stored pool:`, generationError);
  }

  const { data: challenges } = await service
    .from("arena_challenges")
    .select("id, title, category, difficulty, time_limit_minutes, scenario, objective, language, starter_code, stdin, skill_tags, created_at")
    .eq("track", track)
    .eq("scope_key", scope.scopeKey)
    .eq("active", true)
    .order("difficulty")
    .order("created_at");

  const { data: completions } = await service.from("arena_challenge_completions").select("challenge_id, is_correct").eq("user_id", userId).eq("track", track);
  const solvedIds = new Set((completions ?? []).filter((c) => c.is_correct).map((c) => c.challenge_id));

  const next = recommendNextChallenge(challenges ?? [], solvedIds);

  return {
    scopeKey: scope.scopeKey,
    scopeLabel: scope.promptLabel,
    challenges: (challenges ?? []).map((c) => ({ ...c, solved: solvedIds.has(c.id) })),
    nextChallengeId: next?.id ?? null,
  };
}

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const service = createServiceClient();
  const [streamScope, domainScope] = await Promise.all([
    resolveTrackScope(supabase, auth.userId, "stream"),
    resolveTrackScope(supabase, auth.userId, "domain"),
  ]);

  const [stream, domain] = await Promise.all([
    loadTrackState(service, auth.userId, "stream", streamScope),
    loadTrackState(service, auth.userId, "domain", domainScope),
  ]);

  return NextResponse.json({ stream, domain });
}
