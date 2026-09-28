import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { isChallengeTrack } from "@/lib/arena-challenges/resolve-scope";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";
import { advanceStreak } from "@/lib/arena-challenges/streak";
import { currentWeekStart } from "@/lib/arena-challenges/week";
import { deriveArenaChallengeEvidence, ARENA_CHALLENGES_ANALYSIS_VERSION } from "@/lib/evidence/from-arena-challenges";
import { recordEvidence } from "@/lib/evidence/record";

const BodySchema = z.object({ challengeId: z.string().uuid(), code: z.string().min(1) });

/** Any active challenge for the resolved scope can be submitted directly — there is no weekly batch/reveal gate. "Once passed it locks": a challenge already solved correctly can't be re-awarded points. */
export async function POST(request: Request, { params }: { params: Promise<{ track: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_challenge_submit", maxRequests: 20, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { track } = await params;
  if (!isChallengeTrack(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 404 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: challenge } = await service
    .from("arena_challenges")
    .select("id, title, category, scope_key, language, stdin, expected_output, difficulty, skill_tags")
    .eq("id", parsed.data.challengeId)
    .eq("track", track)
    .eq("active", true)
    .maybeSingle();
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
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
  const pointsEarned = isCorrect ? pointsForDifficulty(challenge.difficulty) : 0;
  const nowIso = new Date().toISOString();

  // Points/streak are only ever awarded the first time this challenge goes
  // correct for this student -- a resubmission (retry after a wrong
  // answer, or re-running an already-solved one) must never double-count.
  const { data: existing } = await service.from("arena_challenge_completions").select("is_correct").eq("user_id", auth.userId).eq("challenge_id", challenge.id).maybeSingle();
  const alreadyAwarded = existing?.is_correct === true;

  const { data: completion, error: completionError } = await service
    .from("arena_challenge_completions")
    .upsert(
      {
        user_id: auth.userId,
        challenge_id: challenge.id,
        track,
        scope_key: challenge.scope_key,
        code_submitted: parsed.data.code,
        is_correct: isCorrect,
        elo_delta: pointsEarned,
        completed_at: nowIso,
      },
      { onConflict: "user_id,challenge_id" }
    )
    .select("id")
    .single();
  if (completionError || !completion) {
    return NextResponse.json({ error: "Could not record the submission." }, { status: 500 });
  }

  if (isCorrect && !alreadyAwarded) {
    const { data: stats } = await service.from("arena_challenge_stats").select("points, tasks_completed, current_streak, longest_streak, last_completed_week").eq("user_id", auth.userId).maybeSingle();
    const nextStreak = advanceStreak(
      {
        currentStreak: stats?.current_streak ?? 0,
        longestStreak: stats?.longest_streak ?? 0,
        lastCompletedWeek: stats?.last_completed_week ?? null,
      },
      currentWeekStart()
    );
    await service.from("arena_challenge_stats").upsert({
      user_id: auth.userId,
      points: (stats?.points ?? 0) + pointsEarned,
      tasks_completed: (stats?.tasks_completed ?? 0) + 1,
      current_streak: nextStreak.currentStreak,
      longest_streak: nextStreak.longestStreak,
      last_completed_week: nextStreak.lastCompletedWeek,
      updated_at: nowIso,
    });
  }

  try {
    const evidenceRows = deriveArenaChallengeEvidence({
      id: completion.id,
      challengeTitle: challenge.title,
      track: track,
      scopeKey: challenge.scope_key,
      skillTags: challenge.skill_tags,
      isCorrect,
      completedAt: nowIso,
    });
    await recordEvidence(service, auth.userId, "arena_challenge", ARENA_CHALLENGES_ANALYSIS_VERSION, evidenceRows);
  } catch (evidenceError) {
    console.error("[arena/challenges/submit] evidence write failed (submission itself is unaffected):", evidenceError);
  }

  return NextResponse.json({ isCorrect, stdout, stderr, pointsEarned });
}
