import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { TIME_UP_TOLERANCE_SECONDS, expireIfTimedOut } from "@/lib/arena-workstations/attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

/** The workspace reports that the clock reached zero. The server checks its own record of the time before closing anything. */
export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_expire", maxRequests: 20, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const result = await expireIfTimedOut(createServiceClient(), auth.userId, attemptId, TIME_UP_TOLERANCE_SECONDS);
    if (!result) return NextResponse.json({ error: "The time is not up yet.", code: "not_yet" }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain/expire");
  }
}
