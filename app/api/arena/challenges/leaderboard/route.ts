import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getStudentBranchContext } from "@/lib/assessment/attempts";

const LEADERBOARD_LIMIT = 50;

interface StatRow {
  user_id: string;
  points: number;
  tasks_completed: number;
  current_streak: number;
}

/**
 * Global: top point-earners across everyone. My Branch: same, filtered to
 * students who share the viewer's exact branch (not the IT cluster --
 * "My Branch" means literally their own branch, a finer grain than the
 * shared challenge pool).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const scope = new URL(request.url).searchParams.get("scope") === "branch" ? "branch" : "global";

  let userIdsInBranch: string[] | null = null;
  if (scope === "branch") {
    const { branch } = await getStudentBranchContext(supabase, auth.userId);
    if (!branch) return NextResponse.json({ entries: [], viewerBranch: null });

    const { data: memberships } = await supabase.from("institution_memberships").select("user_id").eq("branch", branch);
    userIdsInBranch = (memberships ?? []).map((m) => m.user_id);
    if (userIdsInBranch.length === 0) return NextResponse.json({ entries: [], viewerBranch: branch });
  }

  let query = supabase
    .from("arena_stream_stats")
    .select("user_id, points, tasks_completed, current_streak")
    .order("points", { ascending: false })
    .limit(LEADERBOARD_LIMIT);
  if (userIdsInBranch) query = query.in("user_id", userIdsInBranch);

  const { data: stats, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stats || stats.length === 0) return NextResponse.json({ entries: [] });

  const { data: profiles } = await supabase.rpc("get_public_profiles", { p_ids: stats.map((s: StatRow) => s.user_id) });
  const { data: memberships } = await supabase.from("institution_memberships").select("user_id, branch").in("user_id", stats.map((s: StatRow) => s.user_id));
  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
  const branchById = new Map((memberships ?? []).map((m) => [m.user_id, m.branch]));

  const entries = stats.map((s: StatRow, i: number) => ({
    userId: s.user_id,
    name: nameById.get(s.user_id) ?? null,
    branch: branchById.get(s.user_id) ?? null,
    points: s.points,
    tasksCompleted: s.tasks_completed,
    streak: s.current_streak,
    rank: i + 1,
    isViewer: s.user_id === auth.userId,
  }));

  return NextResponse.json({ entries });
}
