import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface EducationHistory {
  institutionName: string | null;
  collegeType: string | null;
  city: string | null;
  state: string | null;
  branch: string | null;
  year: string | null;
  programName: string | null;
  departmentName: string | null;
  cohortName: string | null;
  memberSince: string | null;
  assessmentCompletedAt: string | null;
  guidePathGeneratedAt: string | null;
}

interface MembershipEmbed {
  branch: string | null;
  year: string | null;
  created_at: string;
  institutions: { name: string; college_type: string; city: string | null; state: string | null } | null;
  cohorts: {
    name: string;
    departments: { name: string; programs: { name: string } | null } | null;
  } | null;
}

/**
 * The student's real institutional/academic record — not a fabricated
 * multi-school history (no such data exists). cohort/department/program
 * are real tables (added for the Journey Engine work) but no membership
 * has one assigned yet in production — every field below degrades to a
 * clear "not yet assigned" state rather than guessing.
 */
export async function getEducationHistory(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<EducationHistory> {
  const [{ data: membership }, { data: attempt }, { data: guidePath }] = await Promise.all([
    supabase
      .from("institution_memberships")
      .select(
        "branch, year, created_at, institutions ( name, college_type, city, state ), cohorts ( name, departments ( name, programs ( name ) ) )"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("assessment_attempts").select("completed_at").eq("user_id", userId).maybeSingle(),
    supabase
      .from("guide_paths")
      .select("generated_at")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  const m = membership as MembershipEmbed | null;
  const institution = m?.institutions ?? null;
  const cohort = m?.cohorts ?? null;
  const department = cohort?.departments ?? null;
  const program = department?.programs ?? null;

  return {
    institutionName: institution?.name ?? null,
    collegeType: institution?.college_type ?? null,
    city: institution?.city ?? null,
    state: institution?.state ?? null,
    branch: m?.branch ?? null,
    year: m?.year ?? null,
    programName: program?.name ?? null,
    departmentName: department?.name ?? null,
    cohortName: cohort?.name ?? null,
    memberSince: m?.created_at ?? null,
    assessmentCompletedAt: attempt?.completed_at ?? null,
    guidePathGeneratedAt: guidePath?.generated_at ?? null,
  };
}
