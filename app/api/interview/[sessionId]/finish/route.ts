import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { scoreInterviewTranscript, type TranscriptTurn } from "@/lib/interview/session";
import type { Json } from "@/lib/supabase/types";

const BodySchema = z.object({ answers: z.array(z.string()).min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "interview_finish", maxRequests: 10, windowSeconds: 60 });
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
  if (session.status !== "in_progress") return NextResponse.json({ error: "This session is already finished." }, { status: 409 });

  const questions = session.questions as string[];
  const transcript: TranscriptTurn[] = questions.map((question, i) => ({ question, answer: parsed.data.answers[i] ?? "" }));

  let score;
  try {
    score = await scoreInterviewTranscript(session.mode, session.role_target, transcript);
  } catch {
    return NextResponse.json({ error: "Could not score the interview — try again." }, { status: 502 });
  }

  const completedAt = new Date().toISOString();
  const { error } = await service
    .from("ai_interview_sessions")
    .update({
      status: "completed",
      transcript: transcript as unknown as Json,
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
