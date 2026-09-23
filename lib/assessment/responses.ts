import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AssessmentSection } from "./sections";

export class InvalidResponseError extends Error {}

/**
 * Persists a single answer immediately — a refresh/crash mid-question must
 * never lose progress. Grades server-side against question_bank so the
 * correct_option is never exposed to the client.
 */
export async function recordResponse(
  supabase: SupabaseClient<Database>,
  attemptId: string,
  userId: string,
  section: AssessmentSection,
  questionIndex: number,
  selectedOption: string
): Promise<{ isCorrect: boolean }> {
  const { data: progress, error: progressError } = await supabase
    .from("assessment_section_progress")
    .select("question_order, current_index")
    .eq("attempt_id", attemptId)
    .eq("section", section)
    .maybeSingle();
  if (progressError) throw progressError;
  if (!progress) throw new InvalidResponseError("Section has not been started");

  const questionId = progress.question_order?.[questionIndex];
  if (!questionId) throw new InvalidResponseError("Question index out of range");

  const questionTable = section === "career_interests" ? "career_interest_questions" : "question_bank";
  const { data: question, error: questionError } = await supabase
    .from(questionTable)
    .select("correct_option")
    .eq("id", questionId)
    .single();
  if (questionError) throw questionError;

  const isCorrect = question.correct_option === selectedOption;

  const { error: upsertError } = await supabase.from("assessment_responses").upsert(
    {
      attempt_id: attemptId,
      user_id: userId,
      section,
      question_index: questionIndex,
      question_id: section === "career_interests" ? null : questionId,
      selected_option: selectedOption,
      is_correct: isCorrect,
    },
    { onConflict: "attempt_id,section,question_index" }
  );
  if (upsertError) throw upsertError;

  const nextIndex = Math.max(progress.current_index, questionIndex + 1);
  const { error: progressUpdateError } = await supabase
    .from("assessment_section_progress")
    .update({ current_index: nextIndex })
    .eq("attempt_id", attemptId)
    .eq("section", section);
  if (progressUpdateError) throw progressUpdateError;

  return { isCorrect };
}
