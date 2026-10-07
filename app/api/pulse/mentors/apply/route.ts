import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { MentorApplicationSchema } from "@/lib/pulse/mentor-schema";
import { saveMentorApplication } from "@/lib/pulse/mentors";

/** Apply to be a mentor, or edit your profile. Capabilio reviews it before any badge or listing appears. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "mentor_apply", maxRequests: 10, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = MentorApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again." }, { status: 400 });
  const result = await saveMentorApplication(createServiceClient(), auth.userId, parsed.data);
  return result.ok ? NextResponse.json({ ok: true, status: result.status }) : NextResponse.json({ error: result.message }, { status: result.status });
}
