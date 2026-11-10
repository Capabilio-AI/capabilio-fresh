import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { findTrack } from "@/lib/languages";
import { completeLesson } from "@/lib/languages/progress";

const Body = z.object({ track: z.string().max(20), lessonKey: z.string().max(80), correct: z.number().int().min(0).max(10), total: z.number().int().min(1).max(10) }).strict();

/** Marks a language-track lesson done with the score on its check questions. Practice progress only: it never changes an ELO or a badge. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "language_progress", maxRequests: 60, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const track = findTrack(body.data.track);
  if (!track) return NextResponse.json({ error: "That track does not exist." }, { status: 404 });
  const res = await completeLesson(createServiceClient(), auth.userId, track, body.data.lessonKey, body.data.correct, body.data.total);
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}
