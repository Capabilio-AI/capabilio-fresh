import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { StudentDirection } from "./direction";

export interface JobTrackSignals {
  /** Verified Arena completions since the student last dismissed/reviewed the Portfolio prompt. */
  newVerifiedCompletions: number;
  completedInterviewSessions: number;
}

/** Pure: the Portfolio prompt fires only when there is at least one real new completion. */
export const portfolioPromptDue = (s: JobTrackSignals): boolean => s.newVerifiedCompletions > 0;

/** Real events only: arena_attempt_completions rows and finished ai_interview_sessions. */
export async function getJobTrackSignals(
  service: SupabaseClient<Database>,
  userId: string,
  direction: StudentDirection
): Promise<JobTrackSignals> {
  let completions = service
    .from("arena_attempt_completions")
    .select("attempt_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (direction.portfolioPromptSeenAt) completions = completions.gt("completed_at", direction.portfolioPromptSeenAt);

  const [{ count: newCount }, { count: interviewCount }] = await Promise.all([
    completions,
    service
      .from("ai_interview_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);
  return { newVerifiedCompletions: newCount ?? 0, completedInterviewSessions: interviewCount ?? 0 };
}
