import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { activateStage } from "@/lib/arena-roles/session/stage-attempt";
import { sessionErrorResponse } from "@/lib/arena-roles/session/http";

// generating a stage's ticket calls the AI, so this can take as long as a daily ticket does
export const maxDuration = 300;

/** Makes the stage the student is on available (generates it on first call, returns the same one afterwards). */
export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_session_stage", maxRequests: 12, windowSeconds: 600 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);
  const { sessionId } = await params;
  try {
    return NextResponse.json(await activateStage(createServiceClient(), auth.userId, sessionId));
  } catch (error) {
    return sessionErrorResponse(error, "arena/sessions/stage");
  }
}
