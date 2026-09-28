import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { ensureChallengePool } from "@/lib/arena-challenges/generate";
import { pickNextChallenge } from "@/lib/arena-challenges/rotation";
import { getStudentBranchContext } from "@/lib/assessment/attempts";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";

/**
 * Picks this slot's next challenge server-side via the real rotation
 * algorithm -- the client's wheel animation only reveals this result, it
 * never decides anything itself.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_challenge_spin", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const { slotId } = await params;
  const service = createServiceClient();

  const { data: slot } = await service
    .from("arena_challenge_slots")
    .select("id, user_id, track, cooldown_until, challenge_id, recent_challenge_ids, recent_categories")
    .eq("id", slotId)
    .maybeSingle();

  if (!slot || slot.user_id !== auth.userId) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }
  const stillCoolingDown = slot.cooldown_until && new Date(slot.cooldown_until).getTime() > Date.now();
  if (stillCoolingDown || slot.challenge_id) {
    return NextResponse.json({ error: "This slot already has a challenge or is on cooldown." }, { status: 409 });
  }

  // Derive this slot's scope the same way the GET route does, so a stale
  // client can't request a spin for a branch/career the student no longer
  // has on record.
  const scopeKey =
    slot.track === "stream"
      ? (await getStudentBranchContext(supabase, auth.userId)).branch
      : await getStatedCareerInterest(supabase, auth.userId);
  if (!scopeKey) {
    return NextResponse.json({ error: "No branch/career on record to spin for." }, { status: 409 });
  }

  await ensureChallengePool(service, slot.track as "stream" | "domain", scopeKey);

  const { data: pool } = await service
    .from("arena_challenges")
    .select("id, category")
    .eq("track", slot.track)
    .eq("scope_key", scopeKey)
    .eq("active", true);

  const picked = pickNextChallenge(pool ?? [], {
    recentChallengeIds: slot.recent_challenge_ids,
    recentCategories: slot.recent_categories,
  });
  if (!picked) {
    return NextResponse.json({ error: "No challenges available for this scope yet — try again shortly." }, { status: 503 });
  }

  const { data: challenge, error } = await service
    .from("arena_challenges")
    .select("id, title, category, difficulty, time_limit_minutes, scenario, objective, language, starter_code, stdin, skill_tags")
    .eq("id", picked.id)
    .single();
  if (error || !challenge) {
    return NextResponse.json({ error: "Could not load the picked challenge." }, { status: 500 });
  }

  await service
    .from("arena_challenge_slots")
    .update({ challenge_id: challenge.id, assigned_at: new Date().toISOString(), cooldown_until: null })
    .eq("id", slotId);

  return NextResponse.json({ challenge });
}
