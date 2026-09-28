import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { ARENA_ANALYSIS_VERSION, deriveArenaEvidence } from "@/lib/evidence/from-arena";
import { recordEvidence } from "@/lib/evidence/record";

export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { attemptId } = await params;
  // finish_arena_challenge remains the real, untouched scoring path (see
  // docs/evidence-engine-audit.md -- deliberately left alone across prior
  // sessions). Evidence is written here, after it succeeds, from its own
  // row -- never by recomputing scoring logic in application code.
  const { data, error } = await supabase.rpc("finish_arena_challenge", { p_attempt_id: attemptId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    const service = createServiceClient();
    const { data: attempt } = await service
      .from("arena_challenge_attempts")
      .select("id, section, status, answered_count, correct_count, completed_at, rating_before, rating_delta, rating_after")
      .eq("id", attemptId)
      .single();

    if (attempt) {
      const evidenceRow = deriveArenaEvidence({
        id: attempt.id,
        section: attempt.section,
        status: attempt.status,
        answeredCount: attempt.answered_count,
        correctCount: attempt.correct_count,
        completedAt: attempt.completed_at,
        ratingBefore: attempt.rating_before,
        ratingDelta: attempt.rating_delta,
        ratingAfter: attempt.rating_after,
      });
      if (evidenceRow) {
        await recordEvidence(service, auth.userId, "arena_challenge", ARENA_ANALYSIS_VERSION, [evidenceRow]);
      }
    }
  } catch (evidenceError) {
    console.error("[arena/finish] evidence write failed (challenge result itself is unaffected):", evidenceError);
  }

  return NextResponse.json(data);
}
