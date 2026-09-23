import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/supabase/types";
import { SECTION_ORDER, type AssessmentSection } from "./sections";

export interface BranchContext {
  collegeType: Enums<"college_type"> | null;
  branch: string | null;
}

export interface SectionStatus {
  section: AssessmentSection;
  status: "not_started" | "in_progress" | "completed";
}

export interface AttemptProgress {
  attemptId: string;
  attemptStatus: "in_progress" | "completed";
  sections: SectionStatus[];
  currentSection: AssessmentSection | null;
  completedCount: number;
}

/** Idempotent: returns the existing attempt if the student already started one. */
export async function startOrResumeAttempt(supabase: SupabaseClient<Database>, userId: string) {
  const { data: existing } = await supabase
    .from("assessment_attempts")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("assessment_attempts")
    .insert({ user_id: userId })
    .select("id, status")
    .single();

  if (error) throw error;
  return data;
}

export async function getAttemptProgress(
  supabase: SupabaseClient<Database>,
  attemptId: string
): Promise<AttemptProgress> {
  // Independent of each other — both only need attemptId — so fire
  // together instead of paying two sequential round trips.
  const [
    { data: attempt, error: attemptError },
    { data: progressRows, error: progressError },
  ] = await Promise.all([
    supabase.from("assessment_attempts").select("id, status").eq("id", attemptId).single(),
    supabase.from("assessment_section_progress").select("section, status").eq("attempt_id", attemptId),
  ]);
  if (attemptError) throw attemptError;
  if (progressError) throw progressError;

  const bySection = new Map(progressRows?.map((row) => [row.section, row.status]) ?? []);
  const sections: SectionStatus[] = SECTION_ORDER.map((section) => ({
    section,
    status: bySection.get(section) ?? "not_started",
  }));

  return buildProgress(attempt, sections);
}

function buildProgress(
  attempt: { id: string; status: "in_progress" | "completed" },
  sections: SectionStatus[]
): AttemptProgress {
  const currentSection = sections.find((s) => s.status !== "completed")?.section ?? null;
  const completedCount = sections.filter((s) => s.status === "completed").length;
  return {
    attemptId: attempt.id,
    attemptStatus: attempt.status,
    sections,
    currentSection,
    completedCount,
  };
}

export interface AcademicContext extends BranchContext {
  year: string | null;
}

export async function getStudentBranchContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AcademicContext> {
  const { data } = await supabase
    .from("institution_memberships")
    .select("branch, year, institutions ( college_type )")
    .eq("user_id", userId)
    .maybeSingle();

  const institution = data?.institutions as { college_type: BranchContext["collegeType"] } | null;
  return {
    collegeType: institution?.college_type ?? null,
    branch: data?.branch ?? null,
    year: data?.year ?? null,
  };
}
