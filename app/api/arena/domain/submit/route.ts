import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";
import { addChallengePoints } from "@/lib/arena-challenges/award";
import { DATA_ANALYST } from "@/lib/domain-workstations/roles";
import { runSqlQueries } from "@/lib/domain-workstations/sql-runner";
import { gradeSqlResult } from "@/lib/domain-workstations/grade";
import { COOLDOWN_MS } from "@/lib/domain-workstations/daily";
import { deriveArenaChallengeEvidence, ARENA_CHALLENGES_ANALYSIS_VERSION } from "@/lib/evidence/from-arena-challenges";
import { recordEvidence } from "@/lib/evidence/record";

const BodySchema = z.object({
  assignmentId: z.string().uuid(),
  query: z.string().trim().min(1).max(5000),
  note: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_domain_submit", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a query before submitting." }, { status: 400 });

  const service = createServiceClient();
  const { data: assignment } = await service
    .from("arena_domain_assignments")
    .select("id, challenge_id, completed_at")
    .eq("id", parsed.data.assignmentId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (assignment.completed_at) return NextResponse.json({ error: "This ticket is already closed." }, { status: 409 });

  const { data: ticket } = await service.from("arena_challenges").select("id, title, scope_key, difficulty, skill_tags, ground_truth_query").eq("id", assignment.challenge_id).single();
  if (!ticket?.ground_truth_query) {
    console.error(`[arena/domain/submit] ticket ${assignment.challenge_id} has no ground_truth_query`);
    return NextResponse.json({ error: "This ticket can't be graded right now." }, { status: 500 });
  }

  let expected, actual;
  try {
    [expected, actual] = await runSqlQueries(DATA_ANALYST.seedSql, [ticket.ground_truth_query, parsed.data.query]);
  } catch (error) {
    console.error("[arena/domain/submit] SQL runner failed:", error);
    return NextResponse.json({ error: "The query engine is unavailable — your ticket is still open, try again in a moment." }, { status: 502 });
  }

  let feedback;
  try {
    feedback = gradeSqlResult(expected, actual);
  } catch (error) {
    console.error(`[arena/domain/submit] ground truth failed for ticket ${ticket.id}:`, error);
    return NextResponse.json({ error: "This ticket can't be graded right now." }, { status: 500 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const pointsEarned = feedback.passed ? pointsForDifficulty(ticket.difficulty) : 0;

  const { data: completion } = await service
    .from("arena_challenge_completions")
    .upsert(
      {
        user_id: auth.userId,
        challenge_id: ticket.id,
        track: "domain",
        scope_key: ticket.scope_key,
        code_submitted: parsed.data.note ? `${parsed.data.query}\n\n-- Note to requester:\n-- ${parsed.data.note.replace(/\n/g, "\n-- ")}` : parsed.data.query,
        is_correct: feedback.passed,
        elo_delta: pointsEarned,
        completed_at: nowIso,
      },
      { onConflict: "user_id,challenge_id" }
    )
    .select("id")
    .single();

  let nextAvailableAt: string | null = null;
  if (feedback.passed) {
    nextAvailableAt = new Date(now.getTime() + COOLDOWN_MS).toISOString();
    // Only the request that actually closes the ticket awards points —
    // a double-click can't award twice.
    const { data: closed } = await service
      .from("arena_domain_assignments")
      .update({ completed_at: nowIso, next_available_at: nextAvailableAt })
      .eq("id", assignment.id)
      .is("completed_at", null)
      .select("id");
    if (closed && closed.length > 0) {
      await addChallengePoints(service, auth.userId, pointsEarned, nowIso);
      if (completion) {
        try {
          const rows = deriveArenaChallengeEvidence({
            id: completion.id,
            challengeTitle: ticket.title,
            track: "domain",
            scopeKey: ticket.scope_key,
            skillTags: ticket.skill_tags,
            isCorrect: true,
            completedAt: nowIso,
          });
          await recordEvidence(service, auth.userId, "arena_challenge", ARENA_CHALLENGES_ANALYSIS_VERSION, rows);
        } catch (evidenceError) {
          console.error("[arena/domain/submit] evidence write failed (submission itself is unaffected):", evidenceError);
        }
      }
    }
  }

  return NextResponse.json({ feedback, result: actual, pointsEarned, nextAvailableAt });
}
