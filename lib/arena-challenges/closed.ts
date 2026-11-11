import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

/**
 * The challenges this student is finished with: any attempt that has ended, passed, failed, timed out or abandoned, counts. A challenge is given
 * to a student once; they never get the same one again, so the next set always has new ones. An attempt still in progress is not finished.
 */
export async function closedChallengeIds(service: SupabaseClient<Database>, userId: string): Promise<Set<string>> {
  const db = untyped(service);
  const [attempts, completions] = await Promise.all([
    db.from("challenge_attempts").select("challenge_id").eq("student_id", userId).neq("status", "IN_PROGRESS").limit(20_000),
    db.from("arena_challenge_completions").select("challenge_id").eq("user_id", userId).limit(20_000),
  ]);
  if (attempts.error) throw attempts.error;
  if (completions.error) throw completions.error;
  return new Set([...((attempts.data ?? []) as { challenge_id: string }[]), ...((completions.data ?? []) as { challenge_id: string }[])].map((r) => r.challenge_id));
}
