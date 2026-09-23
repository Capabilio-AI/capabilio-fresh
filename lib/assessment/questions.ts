import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AssessmentSection } from "./sections";
import { QUESTIONS_PER_SECTION } from "./sections";

export interface SectionQuestion {
  index: number;
  id: string;
  questionKind: "mcq" | "coding";
  questionText: string;
  options: unknown;
  language: string | null;
  starterCode: string | null;
  stdin: string | null;
  answeredOption: string | null;
  // Populated only once this question has been answered — see the
  // get_or_start_section RPC, which never exposes the answer key ahead
  // of the student actually answering that specific question.
  correctOption: string | null;
  isCorrect: boolean | null;
}

export interface SectionQuestionsResult {
  section: AssessmentSection;
  status: "not_started" | "in_progress" | "completed";
  currentIndex: number;
  totalQuestions: number;
  questions: SectionQuestion[];
}

interface RpcResult {
  status: "in_progress" | "completed";
  currentIndex: number;
  questions: {
    index: number;
    id: string;
    questionKind: "mcq" | "coding";
    questionText: string;
    options: unknown;
    language: string | null;
    starterCode: string | null;
    stdin: string | null;
    answeredOption: string | null;
    correctOption: string | null;
    isCorrect: boolean | null;
  }[];
}

/**
 * Resumable question fetch for sections 1-5 (question_bank backed).
 * career_interests is handled separately — see career-interests.ts — since
 * its questions are generated per-attempt, not selected from a shared bank.
 *
 * Delegates to the get_or_start_section RPC, which derives both the
 * caller and their attempt from auth.uid() itself (never trusts a
 * client-supplied user/attempt id — see the migration for why an earlier
 * version of this was a cross-account data leak/corruption bug), and does
 * the progress lookup, tiered branch-adaptive selection, insert, and
 * question+response join in a single database round trip (previously 5-6
 * sequential ones — each Supabase query here costs ~300-500ms, so
 * round-trip count directly drove the "lagging" complaint).
 */
export async function getSectionQuestions(
  supabase: SupabaseClient<Database>,
  section: Exclude<AssessmentSection, "career_interests">
): Promise<SectionQuestionsResult> {
  const { data, error } = await supabase.rpc("get_or_start_section", { p_section: section });
  if (error) throw error;

  const result = data as unknown as RpcResult;
  return {
    section,
    status: result.status,
    currentIndex: result.currentIndex,
    totalQuestions: QUESTIONS_PER_SECTION[section],
    questions: result.questions,
  };
}
