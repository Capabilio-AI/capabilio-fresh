import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { QUESTIONS_PER_SECTION, type AssessmentSection } from "./sections";
import { getAssessmentMode, sectionsForMode } from "./mode";

export class SectionIncompleteError extends Error {}

/** Marks a section complete; only allowed once every question is answered. */
export async function submitSection(
  supabase: SupabaseClient<Database>,
  attemptId: string,
  userId: string,
  section: AssessmentSection
): Promise<{ attemptCompleted: boolean; mode: "full" | "light" }> {
  const { count, error: countError } = await supabase
    .from("assessment_responses")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId)
    .eq("section", section);
  if (countError) throw countError;

  const total = QUESTIONS_PER_SECTION[section];
  if ((count ?? 0) < total) {
    throw new SectionIncompleteError(`Only ${count ?? 0} of ${total} questions answered`);
  }

  const { error: sectionError } = await supabase
    .from("assessment_section_progress")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("attempt_id", attemptId)
    .eq("section", section);
  if (sectionError) throw sectionError;

  const { data: allSections, error: allSectionsError } = await supabase
    .from("assessment_section_progress")
    .select("section, status")
    .eq("attempt_id", attemptId);
  if (allSectionsError) throw allSectionsError;

  const completedSections = new Set(
    (allSections ?? []).filter((s) => s.status === "completed").map((s) => s.section)
  );
  const mode = await getAssessmentMode(supabase, userId);
  const attemptCompleted = sectionsForMode(mode).every((s) => completedSections.has(s));

  if (attemptCompleted) {
    const { error: attemptError } = await supabase
      .from("assessment_attempts")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", attemptId)
      .eq("user_id", userId);
    if (attemptError) throw attemptError;
  }

  return { attemptCompleted, mode };
}
