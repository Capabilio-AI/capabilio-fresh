import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/supabase/types";
import { type AssessmentSection } from "./sections";
import { getAssessmentMode, sectionsForMode, type AssessmentMode } from "./mode";

export interface BranchContext {
  collegeType: Enums<"college_type"> | null;
  branch: string | null;
}

export interface SectionStatus {
  section: AssessmentSection;
  status: "not_started" | "in_progress" | "completed";
}

export interface AttemptProgress {
  mode: AssessmentMode;
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
  attemptId: string,
  userId: string
): Promise<AttemptProgress> {
  // Independent of each other — both only need attemptId — so fire
  // together instead of paying two sequential round trips.
  const [
    { data: attempt, error: attemptError },
    { data: progressRows, error: progressError },
    mode,
  ] = await Promise.all([
    supabase.from("assessment_attempts").select("id, status").eq("id", attemptId).single(),
    supabase.from("assessment_section_progress").select("section, status").eq("attempt_id", attemptId),
    getAssessmentMode(supabase, userId),
  ]);
  if (attemptError) throw attemptError;
  if (progressError) throw progressError;

  const bySection = new Map(progressRows?.map((row) => [row.section, row.status]) ?? []);
  const sections: SectionStatus[] = sectionsForMode(mode).map((section) => ({
    section,
    status: bySection.get(section) ?? "not_started",
  }));

  return buildProgress(attempt, sections, mode);
}

function buildProgress(
  attempt: { id: string; status: "in_progress" | "completed" },
  sections: SectionStatus[],
  mode: AssessmentMode
): AttemptProgress {
  const currentSection = sections.find((s) => s.status !== "completed")?.section ?? null;
  const completedCount = sections.filter((s) => s.status === "completed").length;
  return {
    mode,
    attemptId: attempt.id,
    attemptStatus: attempt.status,
    sections,
    currentSection,
    completedCount,
  };
}

/**
 * A student can end up with more than one institution_memberships row in
 * real data (re-signup, a college switch, a stray duplicate) --
 * `.maybeSingle()` errors on more than one match and silently resolves to
 * "no branch on record" (confirmed live: a real account had one active
 * row with a real branch plus two other rows with branch null). Picks the
 * best row instead of failing: active membership with a branch set, then
 * any row with a branch set, then the most recent row at all, rather than
 * an arbitrary/undefined one.
 */
export async function getStudentBranchContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<BranchContext> {
  const { data } = await supabase
    .from("institution_memberships")
    .select("branch, status, institutions ( college_type )")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const best =
    rows.find((r) => r.status === "active" && r.branch) ?? rows.find((r) => r.branch) ?? rows[0] ?? null;

  const institution = best?.institutions as { college_type: BranchContext["collegeType"] } | null;
  return {
    collegeType: institution?.college_type ?? null,
    branch: best?.branch ?? null,
  };
}
