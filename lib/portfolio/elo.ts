import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Mirrors capabilio-web's ELO_TIERS (theme.js) — keep in sync if either changes. */
export const ELO_TIERS = [
  { min: 0, max: 600, label: "Rookie", color: "#A8A29E" },
  { min: 600, max: 800, label: "Apprentice", color: "#22C55E" },
  { min: 800, max: 1000, label: "Practitioner", color: "#3B82F6" },
  { min: 1000, max: 1200, label: "Expert", color: "#8B5CF6" },
  { min: 1200, max: 1500, label: "Master", color: "#F59E0B" },
  { min: 1500, max: 9999, label: "Elite", color: "#EF4444" },
] as const;

export type EloTier = (typeof ELO_TIERS)[number];

export function getTier(elo: number): EloTier {
  return ELO_TIERS.find((t) => elo >= t.min && elo < t.max) ?? ELO_TIERS[0];
}

export interface PortfolioElo {
  rating: number;
  tier: EloTier;
  /** 0-100 progress toward the next tier; 100 once at the top tier. */
  progressToNextTier: number;
}

const BASELINE_RATING = 400;

/**
 * The one ELO: the rating on the student's primary career in the shared ledger (student_career_elo), the same number the dashboard,
 * the skill graph and the assessment result show. Assessments, verified Arena passes and career projects all move this one row.
 * No primary career or no ledger row yet means the 400 every student starts from.
 */
export async function getPortfolioElo(service: SupabaseClient<Database>, userId: string): Promise<PortfolioElo> {
  const db = service as unknown as SupabaseClient;
  const { data: intent } = await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  const careerId = (intent as { primary_career_id: string | null } | null)?.primary_career_id;
  const { data: row } = careerId
    ? await db.from("student_career_elo").select("rating").eq("student_id", userId).eq("career_id", careerId).maybeSingle()
    : { data: null };
  const rating = Math.round((row as { rating: number } | null)?.rating ?? BASELINE_RATING);
  const tier = getTier(rating);
  const progressToNextTier = tier.max >= 9999 ? 100 : Math.round(((rating - tier.min) / (tier.max - tier.min)) * 100);
  return { rating, tier, progressToNextTier };
}
