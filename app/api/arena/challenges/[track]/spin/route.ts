import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { isChallengeTrack, resolveTrackScope } from "@/lib/arena-challenges/resolve-scope";
import { pickTaskCount } from "@/lib/arena-challenges/points";
import { currentWeekStart } from "@/lib/arena-challenges/week";

/** Picks this week's task count (the wheel result) and creates the week row. Scratching it (a separate call) is what actually reveals the challenges. */
export async function POST(_request: Request, { params }: { params: Promise<{ track: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_challenge_spin", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { track } = await params;
  if (!isChallengeTrack(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 404 });
  }

  const scope = await resolveTrackScope(supabase, auth.userId, track);
  if (!scope) {
    return NextResponse.json({ error: "No branch/career on record to spin for." }, { status: 409 });
  }

  const service = createServiceClient();
  const taskCount = pickTaskCount();

  const { data: week, error } = await service
    .from("arena_challenge_weeks")
    .insert({ user_id: auth.userId, track, week_start: currentWeekStart(), task_count: taskCount, status: "spun" })
    .select("id, task_count")
    .single();

  if (error) {
    // unique_violation: already spun this week.
    if (error.code === "23505") {
      return NextResponse.json({ error: "You've already spun this week." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not spin — try again." }, { status: 500 });
  }

  return NextResponse.json({ weekId: week.id, taskCount: week.task_count });
}
