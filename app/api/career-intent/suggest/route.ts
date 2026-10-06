import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { proposeCareers } from "@/lib/careers/intent";
import { GoalTextSchema } from "@/lib/careers/intent-rules";
import { parseBody, respond } from "@/lib/careers/route";

/** Interpret the student's own-words goal. The result is a PENDING suggestion; their chosen careers do not change until they accept one. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "career_goal_interpret", maxRequests: 10, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = await parseBody(request, GoalTextSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await proposeCareers(createServiceClient(), auth.userId, parsed.body.goalText));
}
