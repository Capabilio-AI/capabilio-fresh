import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AssessmentSection } from "./sections";

export class InvalidResponseError extends Error {}
export class AssessmentNotStartedError extends Error {}

/**
 * Persists a single answer immediately — a refresh/crash mid-question must
 * never lose progress. Grades server-side against question_bank so the
 * correct_option is never exposed to the client.
 *
 * Delegates to the record_assessment_response RPC, which derives the
 * caller and their attempt from auth.uid() itself and does the progress
 * lookup, question lookup, response upsert, and progress-index update in
 * one database round trip (previously 5 sequential ones).
 */
export async function recordResponse(
  supabase: SupabaseClient<Database>,
  section: AssessmentSection,
  questionIndex: number,
  selectedOption: string
): Promise<{ isCorrect: boolean }> {
  const { data, error } = await supabase.rpc("record_assessment_response", {
    p_section: section,
    p_question_index: questionIndex,
    p_selected_option: selectedOption,
  });
  if (error) {
    if (error.message.includes("Assessment not started")) {
      throw new AssessmentNotStartedError(error.message);
    }
    if (error.message.includes("has not been started") || error.message.includes("out of range")) {
      throw new InvalidResponseError(error.message);
    }
    throw error;
  }

  return data as unknown as { isCorrect: boolean };
}
