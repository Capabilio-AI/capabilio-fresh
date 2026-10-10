import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireUser } from "@/lib/api/require-user";
import { resolveStreamScope } from "@/lib/arena-challenges/resolve-scope";
import { getOrAssignWeeklyBatch } from "@/lib/arena-challenges/weekly-batch";
import { loadStreamPool, loadStreamStudentContext } from "@/lib/arena-challenges/stream-context";
import { getSpin } from "@/lib/arena-challenges/spin";
import { IT_CLUSTER_SCOPE_KEY } from "@/lib/arena-challenges/branch-clusters";
import { generateWeeklyChallenges, weeklyPool } from "@/lib/arena-challenges/leetcode/weekly";
import { WEEKLY_TARGET } from "@/lib/arena-challenges/leetcode/problem";
import { timeLimitForDifficulty } from "@/lib/arena-challenges/timer";

export const maxDuration = 300;

/** LeetCode-style problems get a longer clock than the quick classic ones. */
const LEETCODE_MINUTES: Record<string, number> = { easy: 20, medium: 30, hard: 40 };
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

  // the week's challenges open only after the student has spun the wheel and scratched their card
  const { weekStart: spinWeek, spin } = await getSpin(service, auth.userId);
  if (!spin?.revealed) {
    return NextResponse.json({ scopeKey: scope.scopeKey, scopeLabel: scope.promptLabel, branch: scope.branch, weekStart: spinWeek, needsSpin: true, challenges: [], shortfall: 0, emptyReason: null });
  }

  // IT students: this week's problems are written by the AI once a week and stored. If that run is short (quota, outage) the student is
  // served from the stored bank instead (older problems they have not solved); AI is only asked again after a cooldown.
  if (scope.scopeKey === IT_CLUSTER_SCOPE_KEY) {
    const [pool, bank, { data: solvedRows }] = await Promise.all([
      weeklyPool(service),
      loadStreamPool(service, scope),
      service.from("arena_challenge_completions").select("challenge_id").eq("user_id", auth.userId).eq("track", "stream").eq("is_correct", true),
    ]);
    // the weekly run adds new problems only while the bank is below its cap; a full bank is served from the database
    if (pool.total < WEEKLY_TARGET && !pool.generating) after(() => generateWeeklyChallenges(service));
    const solved = new Set((solvedRows ?? []).map((r) => r.challenge_id));
    if (bank.filter((c) => !solved.has(c.id)).length < spin.count) {
      return NextResponse.json({ scopeKey: scope.scopeKey, scopeLabel: scope.promptLabel, branch: scope.branch, weekStart: pool.weekStart, preparing: true, challenges: [], shortfall: 0, emptyReason: null });
    }
  }

  const student = await loadStreamStudentContext(service, auth.userId);
  const batch = await getOrAssignWeeklyBatch(service, auth.userId, scope, student, spin.count);

  const [{ data: challenges }, { data: completions }] = await Promise.all([
    batch.challengeIds.length
      ? untyped(service) // untyped: workstation_template_id postdates the generated types
          .from("arena_challenges")
          .select("id, kind, title, category, difficulty, scenario, objective, language, starter_code, stdin, answer_unit, skill_tags, created_at, workstation_template_id, problem")
          .in("id", batch.challengeIds)
      : Promise.resolve({ data: [] }),
    service.from("arena_challenge_completions").select("challenge_id, is_correct").eq("user_id", auth.userId).eq("track", "stream"),
  ]);
  type Row = { id: string; kind?: string; difficulty: string } & Record<string, unknown>;
  const solvedIds = new Set((completions ?? []).filter((c) => c.is_correct).map((c) => c.challenge_id));

  return NextResponse.json({
    scopeKey: scope.scopeKey,
    scopeLabel: scope.promptLabel,
    branch: scope.branch,
    weekStart: batch.weekStart,
    shortfall: batch.shortfall,
    emptyReason: batch.challengeIds.length === 0 ? "no_published_content" : null,
    challenges: ((challenges ?? []) as Row[])
      .map((c) => ({ ...c, time_limit_minutes: c.kind === "leetcode" ? LEETCODE_MINUTES[c.difficulty] ?? 20 : timeLimitForDifficulty(c.difficulty), solved: solvedIds.has(c.id) }))
      .sort((a, b) => (DIFFICULTY_RANK[a.difficulty] ?? 0) - (DIFFICULTY_RANK[b.difficulty] ?? 0)),
  });
}
