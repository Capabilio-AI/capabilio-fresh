import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

const TABLE = { stream: "arena_stream_stats", domain: "arena_domain_stats" } as const;

/** The viewer's own points/streak for one track — arena_stream_stats and arena_domain_stats are independent tables, never mixed. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const track = new URL(request.url).searchParams.get("track") === "domain" ? "domain" : "stream";

  const { data: stats } = await supabase.from(TABLE[track]).select("points, tasks_completed, current_streak, longest_streak").eq("user_id", auth.userId).maybeSingle();

  return NextResponse.json({
    points: stats?.points ?? 0,
    tasksCompleted: stats?.tasks_completed ?? 0,
    currentStreak: stats?.current_streak ?? 0,
    longestStreak: stats?.longest_streak ?? 0,
  });
}
