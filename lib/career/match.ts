import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { buildCareerMatch, type CareerMatch } from "./skill-gap";

function isRequirementMap(value: Json | null): value is Record<string, number> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Structured rules first, AI second: every number here (readiness, gap,
 * recommendation) comes from computeSkillGaps/buildCareerMatch — plain
 * arithmetic against career_requirements and the student's own
 * capabilities/interests rows. No model call decides a career match.
 */
export async function matchCareersForStudent(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CareerMatch[]> {
  const [{ data: capabilityRows }, { data: interestRow }, { data: requirementRows }] =
    await Promise.all([
      supabase.from("capabilities").select("skill, capability_score, confidence").eq("user_id", userId),
      supabase.from("interests").select("distribution").eq("user_id", userId).maybeSingle(),
      supabase.from("career_requirements").select("career_role, requirements"),
    ]);

  const capabilities = (capabilityRows ?? []).map((c) => ({
    skill: c.skill,
    score: c.capability_score,
    confidence: c.confidence,
  }));

  const distribution = (interestRow?.distribution as Record<string, number> | null) ?? {};

  return (requirementRows ?? [])
    .filter((row) => isRequirementMap(row.requirements))
    .map((row) =>
      buildCareerMatch(
        row.career_role,
        row.requirements as Record<string, number>,
        capabilities,
        distribution[row.career_role] ?? 0
      )
    )
    .sort((a, b) => b.overallReadiness + b.interestLevel - (a.overallReadiness + a.interestLevel));
}
