import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireUser } from "@/lib/api/require-user";

const LEADERBOARD_LIMIT = 50;

/**
 * Global ELO rank across Domain sub-skills — one row per user, averaging every
 * arena_skill_ratings row they have (same averaging getPortfolioElo already
 * uses, lib/portfolio/elo.ts). Domain has no branch to scope by (it's chosen
 * career, not curriculum), so unlike Stream's leaderboard this is global only.
 * arena_skill_ratings is self-read-only by RLS (it's per-candidate evidence,
 * not public like arena_stream_stats) -- the aggregate read needs the service
 * client, same as getPortfolioElo already does for one user.
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const service = createServiceClient();
  const [{ data: areaRatings, error }, { data: skillRatings }] = await Promise.all([
    service.from("arena_skill_ratings").select("user_id, rating"),
    // per-skill ELO from career-based challenges (migration 062) ranks alongside the legacy per-area ratings
    untyped(service).from("arena_skill_elo").select("student_id, rating"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ratings = [...(areaRatings ?? []), ...((skillRatings ?? []) as { student_id: string; rating: number }[]).map((r) => ({ user_id: r.student_id, rating: r.rating }))];
  if (ratings.length === 0) return NextResponse.json({ entries: [] });

  const sums = new Map<string, { total: number; count: number }>();
  for (const r of ratings) {
    const s = sums.get(r.user_id) ?? { total: 0, count: 0 };
    sums.set(r.user_id, { total: s.total + r.rating, count: s.count + 1 });
  }
  const averages = [...sums.entries()]
    .map(([userId, s]) => ({ userId, rating: Math.round(s.total / s.count) }))
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
