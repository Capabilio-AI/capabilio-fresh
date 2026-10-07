import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { attemptErrorResponse, revealHint } from "@/lib/arena-challenges/attempts";

/** Reveal the next hint; each one lowers the score. */
export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "challenge_attempt_hint", maxRequests: 10, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  try {
    return NextResponse.json(await revealHint(createServiceClient(), auth.userId, (await params).attemptId));
  } catch (error) {
    return attemptErrorResponse(error, "arena/challenge-attempts/hint");
  }
}
