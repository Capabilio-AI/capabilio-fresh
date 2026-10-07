import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireUser } from "@/lib/api/require-user";
import { resolveStreamScope } from "@/lib/arena-challenges/resolve-scope";
import { getOrAssignWeeklyBatch } from "@/lib/arena-challenges/weekly-batch";
import { loadStreamStudentContext } from "@/lib/arena-challenges/stream-context";
import { timeLimitForDifficulty } from "@/lib/arena-challenges/timer";

const DIFFICULTY_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/** Exactly this week's assigned batch (see getOrAssignWeeklyBatch) -- never the full pool. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const service = createServiceClient();
  const scope = await resolveStreamScope(supabase, auth.userId);
  if (!scope) {
    return NextResponse.json({ scopeKey: null, scopeLabel: null, weekStart: null, challenges: [], shortfall: 0, emptyReason: "no_branch" });
  }

  const student = await loadStreamStudentContext(service, auth.userId);
  const batch = await getOrAssignWeeklyBatch(service, auth.userId, scope, student);

  const [{ data: challenges }, { data: completions }] = await Promise.all([
    batch.challengeIds.length
      ? untyped(service) // untyped: workstation_template_id postdates the generated types
          .from("arena_challenges")
          .select("id, kind, title, category, difficulty, scenario, objective, language, starter_code, stdin, answer_unit, skill_tags, created_at, workstation_template_id")
          .in("id", batch.challengeIds)
      : Promise.resolve({ data: [] }),
    service.from("arena_challenge_completions").select("challenge_id, is_correct").eq("user_id", auth.userId).eq("track", "stream"),
  ]);
  type Row = { id: string; difficulty: string } & Record<string, unknown>;
  const solvedIds = new Set((completions ?? []).filter((c) => c.is_correct).map((c) => c.challenge_id));

  return NextResponse.json({
    scopeKey: scope.scopeKey,
    scopeLabel: scope.promptLabel,
    branch: scope.branch,
    weekStart: batch.weekStart,
    shortfall: batch.shortfall,
    emptyReason: batch.challengeIds.length === 0 ? "no_published_content" : null,
    challenges: ((challenges ?? []) as Row[])
      .map((c) => ({ ...c, time_limit_minutes: timeLimitForDifficulty(c.difficulty), solved: solvedIds.has(c.id) }))
      .sort((a, b) => (DIFFICULTY_RANK[a.difficulty] ?? 0) - (DIFFICULTY_RANK[b.difficulty] ?? 0)),
  });
}
