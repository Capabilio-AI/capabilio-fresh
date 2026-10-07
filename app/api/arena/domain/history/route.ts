import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { untyped } from "@/lib/org/db";

/** Domain-only completion history — verified workstation attempts, richer than Stream's (rating before/after). Stream's own history: /api/arena/challenges/history. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { data: completions } = await supabase
    .from("arena_attempt_completions")
    .select("attempt_id, challenge_id, skill_area_key, rating_before, rating_delta, rating_after, completed_at")
    .eq("user_id", auth.userId)
    .order("completed_at", { ascending: false })
    .limit(50);

  // Passes from the ticket/workstation attempt model (challenge_attempts), shown alongside the legacy per-area completions.
  const { data: attempts } = await untyped(createServiceClient())
    .from("challenge_attempts")
    .select("id, challenge_id, elo_delta, submitted_at, evidence_status, arena_challenges ( title, track )")
    .eq("student_id", auth.userId)
    .eq("status", "PASSED")
    .order("submitted_at", { ascending: false })
    .limit(50);
  const fromAttempts = ((attempts ?? []) as unknown as { id: string; elo_delta: number | null; submitted_at: string; evidence_status: string | null; arena_challenges: { title: string; track: string } | null }[])
    .filter((a) => a.arena_challenges?.track === "domain")
    .map((a) => ({ id: a.id, ratingDelta: a.elo_delta ?? 0, ratingAfter: null as number | null, completedAt: a.submitted_at, areaName: a.evidence_status === "VERIFIED_AUTOMATED" ? "Verified" : "Completed (not verified)", challenge: { title: a.arena_challenges!.title, company: null as string | null } }));

  if ((!completions || completions.length === 0) && fromAttempts.length === 0) return NextResponse.json({ completions: [] });
  if (!completions || completions.length === 0) return NextResponse.json({ completions: fromAttempts });

  const [{ data: challenges }, { data: areas }] = await Promise.all([
    supabase.from("arena_challenges").select("id, title, content").in("id", completions.map((c) => c.challenge_id)),
    supabase.from("arena_skill_areas").select("area_key, display_name").in("area_key", completions.map((c) => c.skill_area_key)),
  ]);
  const challengeById = new Map((challenges ?? []).map((c) => [c.id, c]));
  const areaNameByKey = new Map((areas ?? []).map((a) => [a.area_key, a.display_name]));

  const legacy = completions.map((c) => ({
      id: c.attempt_id,
      ratingDelta: c.rating_delta,
      ratingAfter: c.rating_after,
      completedAt: c.completed_at,
      areaName: areaNameByKey.get(c.skill_area_key) ?? c.skill_area_key,
      challenge: challengeById.get(c.challenge_id)
        ? { title: challengeById.get(c.challenge_id)!.title, company: (challengeById.get(c.challenge_id)!.content as { company?: string } | null)?.company ?? null }
        : null,
    }));
  const all = [...legacy, ...fromAttempts].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)).slice(0, 50);
  return NextResponse.json({ completions: all });
}