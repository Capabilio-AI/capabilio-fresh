import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireUser } from "@/lib/api/require-user";

const LEADERBOARD_LIMIT = 50;

/**
 * Global ELO rank: one row per student, using the same career ELO ledger (student_career_elo) the dashboard and portfolio show, so a
 * student's rank always matches their rating. A student with ratings on several careers ranks by their highest.
 * The ledger is not publicly readable, so the aggregate read uses the service client.
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const service = createServiceClient();
  const { data: ledger, error } = await untyped(service).from("student_career_elo").select("student_id, rating");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const best = new Map<string, number>();
  for (const r of (ledger ?? []) as { student_id: string; rating: number }[]) best.set(r.student_id, Math.max(best.get(r.student_id) ?? 0, r.rating));
  if (best.size === 0) return NextResponse.json({ entries: [] });

  const averages = [...best.entries()]
    .map(([userId, rating]) => ({ userId, rating: Math.round(rating) }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, LEADERBOARD_LIMIT);

  const userIds = averages.map((a) => a.userId);
  const [{ data: profiles }, { data: stats }] = await Promise.all([
    supabase.rpc("get_public_profiles", { p_ids: userIds }),
    supabase.from("arena_domain_stats").select("user_id, tasks_completed, current_streak").in("user_id", userIds),
  ]);
  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
  const statsById = new Map((stats ?? []).map((s) => [s.user_id, s]));

  const entries = averages.map((a, i) => ({
    userId: a.userId,
    name: nameById.get(a.userId) ?? null,
    rating: a.rating,
    tasksCompleted: statsById.get(a.userId)?.tasks_completed ?? 0,
    streak: statsById.get(a.userId)?.current_streak ?? 0,
    rank: i + 1,
    isViewer: a.userId === auth.userId,
  }));

  return NextResponse.json({ entries });
}
