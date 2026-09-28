import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { advanceHistory } from "@/lib/arena-challenges/rotation";
import { deriveArenaChallengeEvidence, ARENA_CHALLENGES_ANALYSIS_VERSION } from "@/lib/evidence/from-arena-challenges";
import { recordEvidence } from "@/lib/evidence/record";

const COOLDOWN_DAYS = 7;
const BodySchema = z.object({ code: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_challenge_submit", maxRequests: 20, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { slotId } = await params;
  const service = createServiceClient();

  const { data: slot } = await service
    .from("arena_challenge_slots")
    .select("id, user_id, track, challenge_id, recent_challenge_ids, recent_categories")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot || slot.user_id !== auth.userId || !slot.challenge_id) {
    return NextResponse.json({ error: "No active challenge on this slot." }, { status: 404 });
  }

  const { data: challenge } = await service
    .from("arena_challenges")
    .select("id, title, category, scope_key, language, stdin, expected_output, elo_gain, skill_tags")
    .eq("id", slot.challenge_id)
    .single();
  if (!challenge) {
    return NextResponse.json({ error: "Challenge no longer exists." }, { status: 404 });
  }
  if (!isSupportedLanguage(challenge.language)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 500 });
  }

  let stdout: string;
  let stderr: string;
  try {
    const result = await runCode(challenge.language, parsed.data.code, challenge.stdin ?? "");
    stdout = result.stdout;
    stderr = result.stderr || result.compileError;
  } catch {
    return NextResponse.json({ error: "Code execution service is unavailable — try again." }, { status: 502 });
  }

  const isCorrect = stdout.trim() === challenge.expected_output.trim();
  const eloDelta = isCorrect ? challenge.elo_gain : 0;
  const nowIso = new Date().toISOString();

  const { data: completion, error: completionError } = await service
    .from("arena_challenge_completions")
    .insert({
      user_id: auth.userId,
      slot_id: slotId,
      challenge_id: challenge.id,
      track: slot.track,
      scope_key: challenge.scope_key,
      code_submitted: parsed.data.code,
      is_correct: isCorrect,
      elo_delta: eloDelta,
      completed_at: nowIso,
    })
    .select("id")
    .single();
  if (completionError || !completion) {
    return NextResponse.json({ error: "Could not record the submission." }, { status: 500 });
  }

  const nextHistory = advanceHistory(
    { recentChallengeIds: slot.recent_challenge_ids, recentCategories: slot.recent_categories },
    { id: challenge.id, category: challenge.category }
  );
  await service
    .from("arena_challenge_slots")
    .update({
      challenge_id: null,
      recent_challenge_ids: nextHistory.recentChallengeIds,
      recent_categories: nextHistory.recentCategories,
      cooldown_until: new Date(Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", slotId);

  if (isCorrect) {
    const { data: existingRating } = await service.from("arena_ratings").select("rating").eq("user_id", auth.userId).maybeSingle();
    const newRating = (existingRating?.rating ?? 1200) + eloDelta;
    await service.from("arena_ratings").upsert({ user_id: auth.userId, rating: newRating, updated_at: nowIso });
  }

  try {
    const evidenceRows = deriveArenaChallengeEvidence({
      id: completion.id,
      challengeTitle: challenge.title,
      track: slot.track as "stream" | "domain",
      scopeKey: challenge.scope_key,
      skillTags: challenge.skill_tags,
      isCorrect,
      completedAt: nowIso,
    });
    await recordEvidence(service, auth.userId, "arena_challenge", ARENA_CHALLENGES_ANALYSIS_VERSION, evidenceRows);
  } catch (evidenceError) {
    console.error("[arena/challenges/submit] evidence write failed (submission itself is unaffected):", evidenceError);
  }

  return NextResponse.json({ isCorrect, stdout, stderr, eloDelta });
}
