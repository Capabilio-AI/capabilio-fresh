import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { resolveStreamScope } from "@/lib/arena-challenges/resolve-scope";
import { ensureChallengePool } from "@/lib/arena-challenges/generate";
import { recommendNextChallenge } from "@/lib/arena-challenges/recommend-next";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const service = createServiceClient();
  const scope = await resolveStreamScope(supabase, auth.userId);
  if (!scope) {
    return NextResponse.json({ scopeKey: null, scopeLabel: null, challenges: [], nextChallengeId: null });
  }

  // Best-effort top-up: a real backend outage here never blocks the grid
  // from loading with whatever's already stored (see docs/arena-challenges-redesign.md).
  try {
    await ensureChallengePool(service, scope.scopeKey, scope.promptLabel);
  } catch (generationError) {
    console.error(`[arena/challenges] AI generation failed for ${scope.scopeKey}, using the stored pool:`, generationError);
  }

  const { data: challenges } = await service
    .from("arena_challenges")
    .select("id, title, category, difficulty, time_limit_minutes, scenario, objective, language, starter_code, stdin, skill_tags, created_at")
    .eq("track", "stream")
    .eq("scope_key", scope.scopeKey)
    .eq("active", true)
    .order("difficulty")
    .order("created_at");

  const { data: completions } = await service.from("arena_challenge_completions").select("challenge_id, is_correct").eq("user_id", auth.userId).eq("track", "stream");
  const solvedIds = new Set((completions ?? []).filter((c) => c.is_correct).map((c) => c.challenge_id));

  const next = recommendNextChallenge(challenges ?? [], solvedIds);

  return NextResponse.json({
    scopeKey: scope.scopeKey,
    scopeLabel: scope.promptLabel,
    challenges: (challenges ?? []).map((c) => ({ ...c, solved: solvedIds.has(c.id) })),
    nextChallengeId: next?.id ?? null,
  });
}
