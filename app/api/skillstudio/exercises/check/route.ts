import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { failureResponse, overLimit } from "@/lib/assess/http";
import { loadExercise, liveRunner, recordAttempt } from "@/lib/practice/server";
import { checkAgainstTests } from "@/lib/practice/verify";
import { findTrack } from "@/lib/languages";
import { finishStepIfReady, lessonOfExercise } from "@/lib/languages/step-proof";

// Each check runs the student's code on several tests on a shared runner, which can be slow.
export const maxDuration = 120;

const Body = z.object({ exerciseId: z.string().uuid(), code: z.string().min(1).max(10_000) }).strict();

/** Runs a student's code against an exercise's tests. Visible tests show what came out; hidden ones only say pass or fail. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "lesson_exercise_check", 12);
  if (limited) return limited;
  try {
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const service = createServiceClient();
    const exercise = await loadExercise(service, body.data.exerciseId);
    if (!exercise) return NextResponse.json({ error: "That exercise isn't available." }, { status: 404 });

    const outcome = await checkAgainstTests(exercise.language, body.data.code, exercise.tests, liveRunner);
    // the runner never ran the code, so nothing was graded and no attempt is counted
    if (outcome.unavailable) return NextResponse.json({ error: "The code runner is busy right now. Your code was not graded; try again in a moment." }, { status: 503 });
    await recordAttempt(service, auth.userId, exercise.id, outcome.passed, body.data.code);
    // a pass of a language lesson's coding challenge can finish that step (when its questions are answered too): the server decides, from what it recorded
    let step = null;
    if (outcome.passed) {
      const of = await lessonOfExercise(service, exercise.id);
      const track = of ? findTrack(of.track) : undefined;
      if (of && track) step = await finishStepIfReady(service, auth.userId, track, of.lessonKey);
    }
    return NextResponse.json({ passed: outcome.passed, results: outcome.results, error: outcome.error, step });
  } catch (e) {
    return failureResponse(e, "lesson_exercise_check");
  }
}
