import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AssessmentSection } from "./sections";
import { QUESTIONS_PER_SECTION } from "./sections";
import { selectQuestionsForSection, type BranchContext } from "./select-questions";

export interface SectionQuestion {
  index: number;
  id: string;
  questionText: string;
  options: unknown;
  answeredOption: string | null;
}

export interface SectionQuestionsResult {
  section: AssessmentSection;
  status: "not_started" | "in_progress" | "completed";
  currentIndex: number;
  totalQuestions: number;
  questions: SectionQuestion[];
}

/**
 * Resumable question fetch for sections 1-5 (question_bank backed).
 * career_interests is handled separately — see career-interests.ts — since
 * its questions are generated per-attempt, not selected from a shared bank.
 */
export async function getSectionQuestions(
  supabase: SupabaseClient<Database>,
  attemptId: string,
  userId: string,
  section: Exclude<AssessmentSection, "career_interests">,
  branchContext: BranchContext
): Promise<SectionQuestionsResult> {
  let { data: progress } = await supabase
    .from("assessment_section_progress")
    .select("status, question_order, current_index")
    .eq("attempt_id", attemptId)
    .eq("section", section)
    .maybeSingle();

  if (!progress) {
    const questionOrder = await selectQuestionsForSection(supabase, section, branchContext);
    const { data: created, error } = await supabase
      .from("assessment_section_progress")
      .insert({
        attempt_id: attemptId,
        user_id: userId,
        section,
        status: "in_progress",
        question_order: questionOrder,
        started_at: new Date().toISOString(),
      })
      .select("status, question_order, current_index")
      .single();
    if (error) throw error;
    progress = created;
  }

  const questionIds = progress.question_order ?? [];
  const { data: questionRows, error: questionsError } = await supabase
    .from("question_bank")
    .select("id, question_text, options")
    .in("id", questionIds.length > 0 ? questionIds : ["00000000-0000-0000-0000-000000000000"]);
  if (questionsError) throw questionsError;

  const byId = new Map(questionRows?.map((q) => [q.id, q]) ?? []);

  const { data: responses } = await supabase
    .from("assessment_responses")
    .select("question_index, selected_option")
    .eq("attempt_id", attemptId)
    .eq("section", section);
  const answeredByIndex = new Map(responses?.map((r) => [r.question_index, r.selected_option]) ?? []);

  const questions: SectionQuestion[] = questionIds.map((id, index) => {
    const question = byId.get(id);
    return {
      index,
      id,
      questionText: question?.question_text ?? "",
      options: question?.options ?? [],
      answeredOption: answeredByIndex.get(index) ?? null,
    };
  });

  return {
    section,
    status: progress.status,
    currentIndex: progress.current_index,
    totalQuestions: QUESTIONS_PER_SECTION,
    questions,
  };
}
