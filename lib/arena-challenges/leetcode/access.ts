import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { currentStreamWeek } from "../week";
import type { JudgeTest } from "./judge";

export interface LeetcodeChallenge {
  id: string;
  difficulty: string;
  title: string;
  category: string;
  scope_key: string;
  skill_tags: string[];
  tests: JudgeTest[];
  sampleCount: number;
}

/** The challenge plus its judge tests, only if it is a LeetCode-style problem in THIS student's batch for the week. Null otherwise. */
export async function loadLeetcodeForStudent(service: SupabaseClient, userId: string, challengeId: string): Promise<LeetcodeChallenge | null> {
  const db = untyped(service);
  const [{ data: week }, { data: c }, { data: t }] = await Promise.all([
    db.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", currentStreamWeek()).maybeSingle(),
    db.from("arena_challenges").select("id, difficulty, title, category, scope_key, skill_tags, kind").eq("id", challengeId).eq("track", "stream").eq("kind", "leetcode").maybeSingle(),
    db.from("arena_challenge_tests").select("tests, sample_count").eq("challenge_id", challengeId).maybeSingle(),
  ]);
  if (!c || !t || !(week?.challenge_ids as string[] | undefined)?.includes(challengeId)) return null;
  return { id: c.id, difficulty: c.difficulty, title: c.title, category: c.category, scope_key: c.scope_key, skill_tags: c.skill_tags, tests: t.tests as JudgeTest[], sampleCount: t.sample_count };
}
