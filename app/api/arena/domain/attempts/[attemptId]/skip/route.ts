import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { skipAttempt } from "@/lib/arena-workstations/attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

/** Leaves a ticket. Ownership comes from the session. It costs what a wrong answer costs and closes the ticket. */
export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_skip", maxRequests: 5, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { attemptId } = await params;
  try {
    return NextResponse.json(await skipAttempt(createServiceClient(), auth.userId, attemptId));
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain/skip");
  }
}
