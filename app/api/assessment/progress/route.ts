import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getAttemptProgress } from "@/lib/assessment/attempts";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "assessment_progress", maxRequests: 120, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "Assessment not started" }, { status: 404 });
  }

  const progress = await getAttemptProgress(supabase, attempt.id);
  return NextResponse.json(progress);
}
