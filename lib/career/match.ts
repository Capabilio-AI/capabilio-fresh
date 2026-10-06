import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { buildCareerMatch, type CareerMatch } from "./skill-gap";

function isRequirementMap(value: Json | null): value is Record<string, number> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STATED_ROLE_INTEREST = 90;

/** "Software Developer", "software engineer", "SWE" → one comparable key. */
export function normalizeRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/\b(developer|programmer|swe)\b/g, "engineer")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Interest for a catalog role. The AI-written distribution is keyed by free-text
 * role names, so match case/synonym-insensitively; the student's own stated role
 * counts as strong interest even when the distribution never names it.
 */
export function interestForRole(
  careerRole: string,
  distribution: Record<string, number>,
  statedRole: string | null
): number {
  const key = normalizeRole(careerRole);
  const fromDistribution = Object.entries(distribution)
    .filter(([name]) => normalizeRole(name) === key)
    .map(([, value]) => value);
  const stated = statedRole && normalizeRole(statedRole) === key ? STATED_ROLE_INTEREST : 0;
  return Math.max(0, stated, ...fromDistribution);
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
      supabase.from("interests").select("distribution, target_role").eq("user_id", userId).maybeSingle(),
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
        interestForRole(row.career_role, distribution, interestRow?.target_role ?? null)
      )
    )
    .sort((a, b) => b.overallReadiness + b.interestLevel - (a.overallReadiness + a.interestLevel));
}
