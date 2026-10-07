import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { attemptErrorResponse, startChallengeAttempt } from "@/lib/arena-challenges/attempts";

const Body = z.object({ challengeId: z.string().uuid() }).strict();

/** Start a challenge, or resume the open attempt. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "challenge_attempt_start", maxRequests: 20, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "challengeId is required." }, { status: 400 });
  try {
    return NextResponse.json(await startChallengeAttempt(createServiceClient(), auth.userId, body.data.challengeId));
  } catch (error) {
    return attemptErrorResponse(error, "arena/challenge-attempts");
  }
}
