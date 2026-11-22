import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { resolveGoal } from "@/lib/goals/resolve";

const Body = z.object({ text: z.string().trim().min(2, "Tell us a little more.").max(300, "Keep it under 300 characters.") });

/** What a student typed as their goal: the pathway or job role that covers it, or an honest "not yet" that is recorded so it can be built. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  // the job-role matcher is a model call, so this is limited more tightly than a plain read
  const limit = await checkRateLimit(auth.userId, { bucket: "goal_resolve", maxRequests: 20, windowSeconds: 600, failClosed: true });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "That goal is not valid." }, { status: 400 });
  try {
    return NextResponse.json(await resolveGoal(createServiceClient(), auth.userId, body.data.text));
  } catch (e) {
    console.error("[goals] resolve failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not look that up. Please try again." }, { status: 500 });
  }
}
