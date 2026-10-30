import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { scoreInterviewTranscript, QUESTIONS_PER_SESSION, type TranscriptTurn } from "@/lib/interview/session";
import type { Json } from "@/lib/supabase/types";

const BodySchema = z.object({ answers: z.array(z.string().max(4000)).min(1).max(QUESTIONS_PER_SESSION) });

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "interview_finish", maxRequests: 10, windowSeconds: 60, failClosed: true });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const service = createServiceClient();
  const { data: session } = await service
    .from("ai_interview_sessions")
    .select("id, mode, role_target, questions, status, started_at")
    .eq("id", sessionId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questions = session.questions as string[];
  const transcript: TranscriptTurn[] = questions.map((question, i) => ({ question, answer: parsed.data.answers[i] ?? "" }));

  // Claim the session before the (paid) AI call: only one concurrent request can flip in_progress -> completed. The status enum has no
  // 'scoring' value, so the claim is the completion itself and is reverted below if scoring fails.
  const { data: claimed } = await service
    .from("ai_interview_sessions")
    .update({ status: "completed", transcript: transcript as unknown as Json })
    .eq("id", sessionId)
    .eq("user_id", auth.userId)
    .eq("status", "in_progress")
    .select("id");
  if (!claimed || claimed.length === 0) return NextResponse.json({ error: "This session is already finished." }, { status: 409 });

  let score;
  try {
    score = await scoreInterviewTranscript(session.mode, session.role_target, transcript);
  } catch {
    await service.from("ai_interview_sessions").update({ status: "in_progress" }).eq("id", sessionId).eq("user_id", auth.userId);
    return NextResponse.json({ error: "Could not score the interview — try again." }, { status: 502 });
  }

  const completedAt = new Date().toISOString();
  const { error } = await service
    .from("ai_interview_sessions")
    .update({
      overall_score: Math.round(score.overallScore),
      skill_scores: score.skillScores as unknown as Json,
      strengths: score.strengths as unknown as Json,
      improvements: score.improvements as unknown as Json,
      completed_at: completedAt,
    })
    .eq("id", sessionId);
  if (error) return NextResponse.json({ error: "Could not save the result — try again." }, { status: 500 });

  return NextResponse.json({ ...score, completedAt });
}
