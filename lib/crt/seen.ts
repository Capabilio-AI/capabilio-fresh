import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

/**
 * Every CRT question this student has ever been given: answered in practice, a simulator test or a company mock, or served in a placement
 * cell assessment (answered or not, since that attempt is over). Questions in this set are not offered to them again.
 */
export async function seenQuestionIds(service: SupabaseClient<Database>, userId: string): Promise<Set<string>> {
  const db = untyped(service);
  const [log, attempts] = await Promise.all([
    db.from("crt_practice_log").select("question_id").eq("user_id", userId).limit(50_000),
    db.from("crt_attempts").select("question_ids").eq("user_id", userId),
  ]);
  if (log.error) throw log.error;
  if (attempts.error) throw attempts.error;
  return new Set([
    ...((log.data ?? []) as { question_id: string }[]).map((r) => r.question_id),
    ...((attempts.data ?? []) as { question_ids: string[] }[]).flatMap((a) => a.question_ids ?? []),
  ]);
}
