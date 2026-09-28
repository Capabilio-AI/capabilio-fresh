import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

/** Per-challenge completion history — no more per-week batches (see 022_arena_challenges_full_grid.sql). */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { data: completions } = await supabase
    .from("arena_challenge_completions")
    .select("id, track, challenge_id, is_correct, elo_delta, completed_at")
    .eq("user_id", auth.userId)
    .order("completed_at", { ascending: false })
    .limit(50);

  if (!completions || completions.length === 0) return NextResponse.json({ completions: [] });

  const { data: challenges } = await supabase.from("arena_challenges").select("id, title, category, difficulty").in("id", completions.map((c) => c.challenge_id));
  const challengeById = new Map((challenges ?? []).map((c) => [c.id, c]));

  return NextResponse.json({
    completions: completions.map((c) => ({
      id: c.id,
      track: c.track,
      isCorrect: c.is_correct,
      pointsEarned: c.elo_delta,
      completedAt: c.completed_at,
      challenge: challengeById.get(c.challenge_id) ?? null,
    })),
  });
}
