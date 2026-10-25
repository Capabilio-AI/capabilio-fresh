import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getStageState } from "@/lib/stage/server";
import { loadPersonalizationStatus } from "@/lib/personalization/status";

/** What is ready and what is still being prepared for the student's chosen role, read from real backend state. Polled, so it is rate limited per user. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "personalization_status", maxRequests: 120, windowSeconds: 600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  try {
    const { stage } = await getStageState(auth.userId);
    const status = await loadPersonalizationStatus(createServiceClient(), auth.userId, stage === "student");
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[personalization] status failed:", e);
    return NextResponse.json({ error: "We couldn't check your progress. Trying again shortly." }, { status: 503 });
  }
}
