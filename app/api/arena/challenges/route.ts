import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getStudentBranchContext } from "@/lib/assessment/attempts";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { clusterKeyForBranch } from "@/lib/arena-challenges/branch-clusters";
import { currentWeekStart } from "@/lib/arena-challenges/week";

type Track = "stream" | "domain";

async function loadTrackState(service: ReturnType<typeof createServiceClient>, userId: string, track: Track, scopeKey: string | null, scopeLabel: string | null) {
  if (!scopeKey) return { scopeKey: null, scopeLabel: null, week: null };

  const { data: week } = await service
    .from("arena_challenge_weeks")
    .select("id, task_count, status, challenge_ids")
    .eq("user_id", userId)
    .eq("track", track)
    .eq("week_start", currentWeekStart())
    .maybeSingle();

  if (!week) return { scopeKey, scopeLabel, week: null };

  if (week.status === "spun") {
    return { scopeKey, scopeLabel, week: { id: week.id, status: "spun" as const, taskCount: week.task_count } };
  }

  const { data: challenges } = week.challenge_ids.length
    ? await service.from("arena_challenges").select("id, title, category, difficulty, time_limit_minutes, scenario, objective, language, starter_code, stdin, skill_tags").in("id", week.challenge_ids)
    : { data: [] };

  const { data: completions } = await service.from("arena_challenge_completions").select("challenge_id, is_correct").eq("week_id", week.id);
  const solvedIds = new Set((completions ?? []).filter((c) => c.is_correct).map((c) => c.challenge_id));

  return {
    scopeKey,
    scopeLabel,
    week: {
      id: week.id,
      status: "revealed" as const,
      taskCount: week.task_count,
      challenges: (challenges ?? []).map((c) => ({ ...c, solved: solvedIds.has(c.id) })),
    },
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

  const streamScopeKey = branchContext.branch ? clusterKeyForBranch(branchContext.branch) : null;

  const [stream, domain] = await Promise.all([
    loadTrackState(service, auth.userId, "stream", streamScopeKey, branchContext.branch),
    loadTrackState(service, auth.userId, "domain", careerInterest, careerInterest),
  ]);

  return NextResponse.json({ stream, domain });
}
