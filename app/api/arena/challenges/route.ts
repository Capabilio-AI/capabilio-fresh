import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getStudentBranchContext } from "@/lib/assessment/attempts";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";

const SLOTS_PER_TRACK = 3;

type Track = "stream" | "domain";

/** Creates any missing slots for a scope (idempotent — unique on user_id/track/slot_index). */
async function ensureSlots(service: ReturnType<typeof createServiceClient>, userId: string, track: Track) {
  const rows = Array.from({ length: SLOTS_PER_TRACK }, (_, i) => ({ user_id: userId, track, slot_index: i }));
  await service.from("arena_challenge_slots").upsert(rows, { onConflict: "user_id,track,slot_index", ignoreDuplicates: true });
}

async function loadTrackState(service: ReturnType<typeof createServiceClient>, userId: string, track: Track, scopeKey: string | null) {
  if (!scopeKey) return { scopeKey: null, slots: [] };

  await ensureSlots(service, userId, track);

  const { data: slots } = await service
    .from("arena_challenge_slots")
    .select("id, slot_index, challenge_id, assigned_at, cooldown_until")
    .eq("user_id", userId)
    .eq("track", track)
    .order("slot_index");

  const challengeIds = (slots ?? []).map((s) => s.challenge_id).filter((id): id is string => id !== null);
  // Full detail (language/starter_code/stdin), not just a summary -- a
  // student reopening an already-assigned challenge (not freshly spun)
  // still needs everything ChallengeSolvePanel requires to actually run
  // and submit it.
  const { data: challenges } = challengeIds.length
    ? await service
        .from("arena_challenges")
        .select("id, title, category, difficulty, time_limit_minutes, scenario, objective, skill_tags, language, starter_code, stdin")
        .in("id", challengeIds)
    : { data: [] };
  const challengeById = new Map((challenges ?? []).map((c) => [c.id, c]));

  const now = Date.now();
  return {
    scopeKey,
    slots: (slots ?? []).map((slot) => {
      const inCooldown = slot.cooldown_until && new Date(slot.cooldown_until).getTime() > now;
      if (inCooldown) {
        return { id: slot.id, status: "cooldown" as const, cooldownUntil: slot.cooldown_until };
      }
      if (slot.challenge_id && challengeById.has(slot.challenge_id)) {
        return { id: slot.id, status: "active" as const, challenge: challengeById.get(slot.challenge_id) };
      }
      return { id: slot.id, status: "ready_to_spin" as const };
    }),
  };
}

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const service = createServiceClient();
  const [branchContext, careerInterest] = await Promise.all([
    getStudentBranchContext(supabase, auth.userId),
    getStatedCareerInterest(supabase, auth.userId),
  ]);

  const [stream, domain] = await Promise.all([
    loadTrackState(service, auth.userId, "stream", branchContext.branch),
    loadTrackState(service, auth.userId, "domain", careerInterest),
  ]);

  return NextResponse.json({ stream, domain });
}
