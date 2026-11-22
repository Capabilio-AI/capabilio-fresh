import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { findTrack } from "@/lib/languages";
import { gradeLessonCheck } from "@/lib/languages/lesson-check";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { moduleStatuses } from "@/lib/languages/module-gate";

const Body = z.object({ track: z.string().max(20), lessonKey: z.string().max(80), index: z.number().int().min(0).max(9), choice: z.number().int().min(0).max(3) });

/**
 * Marks one answer to a lesson's check question. The answers are not in the lesson page (a module's assessment is drawn from these questions), so
 * this is the only place they are revealed, and only after a student has answered and only for a module they have unlocked.
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "That answer is not valid." }, { status: 400 });
  const limit = await checkRateLimit(auth.userId, { bucket: "lang_check", maxRequests: 120, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const track = findTrack(body.data.track);
  const verdict = track ? gradeLessonCheck(track, body.data.lessonKey, body.data.index, body.data.choice) : null;
  if (!track || !verdict) return NextResponse.json({ error: "That question does not exist." }, { status: 404 });
  // a locked module's questions are not for reading yet: without this, every module's answers could be collected without unlocking it
  const proofs = await loadModuleProofs(createServiceClient(), auth.userId, track.key);
  if (moduleStatuses(track, proofs)[track.modules.findIndex((m) => m.key === verdict.moduleKey)] === "locked") {
    return NextResponse.json({ error: "Prove the module before this one first." }, { status: 403 });
  }
  return NextResponse.json({ correct: verdict.correct, answerIndex: verdict.answerIndex, why: verdict.why });
}
