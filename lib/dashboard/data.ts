import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { SECTION_LABEL, SECTION_ORDER, type AssessmentSection } from "@/lib/assessment/sections";

export class DashboardNotReadyError extends Error {}

export interface SectionScore {
  section: AssessmentSection;
  label: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface DashboardData {
  fullName: string | null;
  email: string;
  collegeName: string | null;
  branch: string | null;
  year: string | null;
  completedAt: string | null;
  sectionScores: SectionScore[];
  overall: { correct: number; total: number; percentage: number };
}

/**
 * Everything the dashboard needs, read straight from the tables the
 * assessment already writes to (assessment_responses, profiles,
 * institution_memberships) — no separate results table to keep in sync.
 * Throws DashboardNotReadyError if the student hasn't finished the
 * assessment yet; the caller should redirect to /assessment.
 */
export async function getDashboardData(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<DashboardData> {
  const [{ data: profile, error: profileError }, { data: membership }, { data: attempt, error: attemptError }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, email").eq("id", userId).single(),
      supabase
        .from("institution_memberships")
        .select("branch, year, institutions ( name )")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("assessment_attempts").select("id, status, completed_at").eq("user_id", userId).maybeSingle(),
    ]);
  if (profileError) throw profileError;
  if (attemptError) throw attemptError;
  if (!attempt || attempt.status !== "completed") {
    throw new DashboardNotReadyError("Assessment not completed yet");
  }

  const { data: responses, error: responsesError } = await supabase
    .from("assessment_responses")
    .select("section, is_correct")
    .eq("attempt_id", attempt.id);
  if (responsesError) throw responsesError;

  const bySection = new Map<AssessmentSection, { correct: number; total: number }>(
    SECTION_ORDER.map((section) => [section, { correct: 0, total: 0 }])
  );
  for (const r of responses ?? []) {
    const bucket = bySection.get(r.section);
    if (!bucket) continue;
    bucket.total += 1;
    if (r.is_correct) bucket.correct += 1;
  }

  const sectionScores: SectionScore[] = SECTION_ORDER.map((section) => {
    const bucket = bySection.get(section)!;
    return {
      section,
      label: SECTION_LABEL[section],
      correct: bucket.correct,
      total: bucket.total,
      percentage: bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : 0,
    };
  });

  const overallCorrect = sectionScores.reduce((sum, s) => sum + s.correct, 0);
  const overallTotal = sectionScores.reduce((sum, s) => sum + s.total, 0);

  const institution = membership?.institutions as { name: string } | null;

  return {
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? "",
    collegeName: institution?.name ?? null,
    branch: membership?.branch ?? null,
    year: membership?.year ?? null,
    completedAt: attempt.completed_at,
    sectionScores,
    overall: {
      correct: overallCorrect,
      total: overallTotal,
      percentage: overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0,
    },
  };
}

export interface SkillRow {
  skill: string;
  domain: string;
  score: number;
  confidence: Database["public"]["Enums"]["capability_confidence"];
}

/** Raw per-skill capability rows for the dashboard's Skills tab, grouped by domain in the UI layer. */
export async function getSkills(supabase: SupabaseClient<Database>, userId: string): Promise<SkillRow[]> {
  const { data, error } = await supabase
    .from("capabilities")
    .select("skill, domain, capability_score, confidence")
    .eq("user_id", userId)
    .order("domain")
    .order("capability_score", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    skill: row.skill,
    domain: row.domain,
    score: row.capability_score,
    confidence: row.confidence,
  }));
}
