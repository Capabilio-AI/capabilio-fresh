import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { currentStreamWeek } from "../week";
import type { AnyAnswer, PublicSqlTask } from "./sql-task";

export interface SqlChallenge {
  id: string;
  difficulty: string;
  title: string;
  category: string;
  scope_key: string;
  skill_tags: string[];
  task: PublicSqlTask;
  answer: AnyAnswer;
}

/** The SQL task plus its answer, only if it is a SQL task in THIS student's batch for the week. Null otherwise. */
export async function loadSqlForStudent(service: SupabaseClient, userId: string, challengeId: string): Promise<SqlChallenge | null> {
  const db = untyped(service);
  const [{ data: week }, { data: c }, { data: t }] = await Promise.all([
    db.from("arena_stream_weeks").select("challenge_ids").eq("user_id", userId).eq("week_start", currentStreamWeek()).maybeSingle(),
    db.from("arena_challenges").select("id, difficulty, title, category, scope_key, skill_tags, problem").eq("id", challengeId).eq("track", "stream").eq("kind", "sql").eq("status", "PUBLISHED").maybeSingle(),
    db.from("arena_challenge_tests").select("tests").eq("challenge_id", challengeId).maybeSingle(),
  ]);
  if (!c || !t || !(week?.challenge_ids as string[] | undefined)?.includes(challengeId)) return null;
  return { id: c.id, difficulty: c.difficulty, title: c.title, category: c.category, scope_key: c.scope_key, skill_tags: c.skill_tags, task: c.problem as PublicSqlTask, answer: ((t.tests as { mode?: string }[])[0]?.mode === "script" ? (t.tests as AnyAnswer[])[0] : { expected: (t.tests as { columns: string[]; rows: (string | number | null)[][] }[])[0] }) as AnyAnswer };
}
