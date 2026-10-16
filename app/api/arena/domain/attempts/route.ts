import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getWorkstationCareer } from "@/lib/career/workstation-career";
import { startNextAttempt } from "@/lib/arena-workstations/attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

export const maxDuration = 300;

/**
 * "Start my next task." The server resolves the role, rotation slot, skill area and difficulty. The only thing the client may ask for is
 * `focus`, a skill area to practise first (for example from a job's skill gap); the server serves it only if it is a real area of the user's
 * own role that is still left in the current cycle, and otherwise ignores it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_start", maxRequests: 6, windowSeconds: 600 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const body = (await request.json().catch(() => null)) as { focus?: unknown } | null;
  const focus = typeof body?.focus === "string" && /^[a-z][a-z0-9_]{1,40}$/.test(body.focus) ? body.focus : undefined;

  try {
    const service = createServiceClient();
    return NextResponse.json(await startNextAttempt(service, auth.userId, await getWorkstationCareer(service, auth.userId), focus));
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain/attempts");
  }
}
