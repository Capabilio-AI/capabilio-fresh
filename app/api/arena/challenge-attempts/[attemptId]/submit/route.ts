import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { attemptErrorResponse, submitChallengeAttempt } from "@/lib/arena-challenges/attempts";

const Body = z.object({ submission: z.unknown(), reflection: z.string().max(2000).nullish() });

/** Run every check (deterministic; AI never grades), then complete the attempt. */
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "challenge_attempt_submit", maxRequests: 10, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "A submission is required." }, { status: 400 });
  try {
    return NextResponse.json(await submitChallengeAttempt(createServiceClient(), auth.userId, (await params).attemptId, { submission: body.data.submission, reflection: body.data.reflection }));
  } catch (error) {
    return attemptErrorResponse(error, "arena/challenge-attempts/submit");
  }
}
