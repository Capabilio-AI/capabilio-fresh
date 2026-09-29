import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { startNextAttempt } from "@/lib/arena-workstations/attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

export const maxDuration = 300;

/**
 * "Start my next task." The body is ignored on purpose: the server resolves
 * the role, rotation slot, skill area and difficulty — none come from the client.
 */
export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_start", maxRequests: 6, windowSeconds: 600 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  try {
    const statedRole = await getStatedCareerInterest(supabase, auth.userId);
    return NextResponse.json(await startNextAttempt(createServiceClient(), auth.userId, statedRole));
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain/attempts");
  }
}
