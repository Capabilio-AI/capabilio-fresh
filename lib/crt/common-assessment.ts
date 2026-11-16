import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import type { Category } from "./categories";

/** A section needs at least this many answered questions before its score is shown: a score from one or two answers says nothing. */
export const MIN_SECTION_ANSWERS = 3;

/** The common-assessment sections that are also a placement-readiness area. Programming and the rest have no area, so they are shown but do not feed the radar. */
const AREA_OF: Record<string, Category> = { quantitative_aptitude: "aptitude", logical_reasoning: "reasoning", verbal_communication: "verbal" };

export interface CommonSection {
  section: string;
  label: string;
  /** 0 to 100 */
  score: number;
  correct: number;
  total: number;
  /** the readiness area this score feeds, or null */
  area: Category | null;
}
export interface CommonAssessment {
  completedAt: string;
  sections: CommonSection[];
}

interface Bar { section: string; label: string; score: number | null; correct: number; total: number }

/** Pure. Keeps the sections with enough answers and tags the ones that feed a readiness area. */
export function commonSections(bars: readonly Bar[]): CommonSection[] {
  return bars
    .filter((b) => b.score !== null && b.total >= MIN_SECTION_ANSWERS)
    .map((b) => ({ section: b.section, label: b.label, score: Math.round(b.score as number), correct: b.correct, total: b.total, area: AREA_OF[b.section] ?? null }));
}

/** The student's most recent finished common assessment. Read live, so retaking it moves the radar the moment it is submitted. */
export async function loadCommonAssessment(service: SupabaseClient<Database>, userId: string): Promise<CommonAssessment | null> {
  const { data } = await untyped(service)
    .from("assess_sessions")
    .select("completed_at, result")
    .eq("student_id", userId)
    .eq("layer", "GENERAL")
    .eq("status", "COMPLETED")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { completed_at: string | null; result: { general?: Bar[] } | null } | null;
  const sections = commonSections(row?.result?.general ?? []);
  return row?.completed_at && sections.length > 0 ? { completedAt: row.completed_at, sections } : null;
}

/** Pure. The common-assessment score for each readiness area, to be combined with the placement cell's assessment. */
export function areaScores(common: CommonAssessment | null): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  for (const s of common?.sections ?? []) if (s.area) out[s.area] = s.score;
  return out;
}
