import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { startOrResumeAttempt, getAttemptProgress } from "@/lib/assessment/attempts";

export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "assessment_start", maxRequests: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const attempt = await startOrResumeAttempt(supabase, auth.userId);
  const progress = await getAttemptProgress(supabase, attempt.id);

  return NextResponse.json(progress);
}
