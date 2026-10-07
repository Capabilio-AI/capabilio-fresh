import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { attemptErrorResponse } from "@/lib/arena-challenges/attempts";
import { requestAiHelp } from "@/lib/arena-challenges/ai-help";

const Body = z.object({ question: z.string().max(300).default("") }).strict();

/** AI explanation of a concept or a failure. Never grades and never reveals the solution; costs score while the attempt is open. */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "challenge_attempt_ai_help", maxRequests: 6, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "question must be at most 300 characters." }, { status: 400 });
  try {
    return NextResponse.json(await requestAiHelp(createServiceClient(), auth.userId, (await params).attemptId, body.data.question));
  } catch (error) {
    return attemptErrorResponse(error, "arena/challenge-attempts/explain");
  }
}
