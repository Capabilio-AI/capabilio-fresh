import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";
import { isNumericAnswerCorrect } from "@/lib/arena-challenges/numeric-answer";
import { addChallengePoints } from "@/lib/arena-challenges/award";
import { deriveArenaChallengeEvidence, ARENA_CHALLENGES_ANALYSIS_VERSION } from "@/lib/evidence/from-arena-challenges";
import { recordEvidence } from "@/lib/evidence/record";
import { judge, type TestVerdict } from "@/lib/arena-challenges/leetcode/judge";
import { loadLeetcodeForStudent } from "@/lib/arena-challenges/leetcode/access";

export const maxDuration = 120;

const BodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(1).max(20000).optional(),
  language: z.string().optional(),
  answer: z.string().min(1).max(100).optional(),
  working: z.string().max(5000).optional(),
});

/** Any active Stream challenge can be submitted directly — there is no batch/reveal gate. "Once passed it locks": a challenge already solved correctly can't be re-awarded points. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_challenge_submit", maxRequests: 20, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: challenge } = await service
    .from("arena_challenges")
    .select("id, kind, title, category, scope_key, language, stdin, expected_output, answer_unit, difficulty, skill_tags")
    .eq("id", parsed.data.challengeId)
    .eq("track", "stream")
    .eq("active", true)
    .maybeSingle();
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
  }

  let isCorrect: boolean;
  let tests: { index: number; passed: boolean; hidden: boolean; input?: string; expected?: string; actual?: string; error?: string }[] | undefined;
  let stdout = "";
  let stderr = "";
  let submission: string;

  if (challenge.kind === "leetcode") {
    // LeetCode-style: judged on every test, hidden ones included. Once passed it is locked: no resubmission, no second award.
    if (!parsed.data.code) return NextResponse.json({ error: "Write your code first." }, { status: 400 });
    const lc = await loadLeetcodeForStudent(service, auth.userId, challenge.id);
    if (!lc) return NextResponse.json({ error: "This challenge isn't in your batch this week." }, { status: 403 });
    const { data: solved } = await service.from("arena_challenge_completions").select("is_correct").eq("user_id", auth.userId).eq("challenge_id", challenge.id).maybeSingle();
    if (solved?.is_correct) return NextResponse.json({ error: "You've already passed this challenge. It is locked." }, { status: 409 });
    let verdicts: TestVerdict[];
    try {
      verdicts = await judge(parsed.data.language ?? "python", parsed.data.code, lc.tests);
    } catch {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }
    if (verdicts.some((v) => v.error.startsWith("Code execution service is unavailable"))) return NextResponse.json({ error: "Code execution service is unavailable. Try again." }, { status: 502 });
    isCorrect = verdicts.every((v) => v.passed);
    tests = verdicts.map((v, i) => {
      const hidden = i >= lc.sampleCount;
      return hidden ? { index: i, passed: v.passed, hidden } : { index: i, passed: v.passed, hidden, input: lc.tests[i].input.trimEnd(), expected: lc.tests[i].output, actual: v.actual.trimEnd(), error: v.error };
    });
    submission = parsed.data.code;
  } else if (challenge.kind === "numeric") {
    if (!parsed.data.answer) return NextResponse.json({ error: "Enter your answer." }, { status: 400 });
    isCorrect = isNumericAnswerCorrect(parsed.data.answer, challenge.expected_output);
    submission = `Answer: ${parsed.data.answer} ${challenge.answer_unit ?? ""}`.trim() + (parsed.data.working ? `\n\nWorking:\n${parsed.data.working}` : "");
  } else {
    if (!parsed.data.code) return NextResponse.json({ error: "Write your code first." }, { status: 400 });
    if (!isSupportedLanguage(challenge.language)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 500 });
    }
    try {
      const result = await runCode(challenge.language, parsed.data.code, challenge.stdin ?? "");
      stdout = result.stdout;
      stderr = result.stderr || result.compileError;
    } catch {
      return NextResponse.json({ error: "Code execution service is unavailable — try again." }, { status: 502 });
    }
    isCorrect = stdout.trim() === challenge.expected_output.trim();
    submission = parsed.data.code;
  }

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
        track: "stream",
        scope_key: challenge.scope_key,
        code_submitted: submission,
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
    await addChallengePoints(service, auth.userId, pointsEarned, nowIso);
  }

  try {
    const evidenceRows = deriveArenaChallengeEvidence({
      id: completion.id,
      challengeTitle: challenge.title,
      track: "stream",
      scopeKey: challenge.scope_key,
      skillTags: challenge.skill_tags,
      isCorrect,
      completedAt: nowIso,
    });
    await recordEvidence(service, auth.userId, "arena_challenge", ARENA_CHALLENGES_ANALYSIS_VERSION, evidenceRows);
  } catch (evidenceError) {
    console.error("[arena/challenges/submit] evidence write failed (submission itself is unaffected):", evidenceError);
  }

  return NextResponse.json({ isCorrect, stdout, stderr, pointsEarned, tests });
}
