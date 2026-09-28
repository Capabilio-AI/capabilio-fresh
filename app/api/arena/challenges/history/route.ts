import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { currentWeekStart } from "@/lib/arena-challenges/week";

/** Past (non-current) revealed weeks, most recent first — how many of that week's tasks were actually solved. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { data: weeks } = await supabase
    .from("arena_challenge_weeks")
    .select("id, track, week_start, task_count, status")
    .eq("user_id", auth.userId)
    .eq("status", "revealed")
    .neq("week_start", currentWeekStart())
    .order("week_start", { ascending: false })
    .limit(20);

  if (!weeks || weeks.length === 0) return NextResponse.json({ weeks: [] });

  const { data: completions } = await supabase
    .from("arena_challenge_completions")
    .select("week_id, is_correct")
    .in("week_id", weeks.map((w) => w.id));

  const solvedByWeek = new Map<string, number>();
  for (const c of completions ?? []) {
    if (!c.is_correct || !c.week_id) continue;
    solvedByWeek.set(c.week_id, (solvedByWeek.get(c.week_id) ?? 0) + 1);
  }

  return NextResponse.json({
    weeks: weeks.map((w) => ({
      id: w.id,
      track: w.track,
      weekStart: w.week_start,
      taskCount: w.task_count,
      solvedCount: solvedByWeek.get(w.id) ?? 0,
    })),
  });
}
