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
 * A single Arena Rating for the portfolio hero card — the average of every
 * skill-area rating the student has actually earned (each area starts at
 * `arena_skill_ratings.rating`'s own default of 400 the moment it's first
 * touched). A student with no completed Arena work yet has no rows at all,
 * so they show the same 400 baseline everyone starts from.
 */
export async function getPortfolioElo(service: SupabaseClient<Database>, userId: string): Promise<PortfolioElo> {
  const { data } = await service.from("arena_skill_ratings").select("rating").eq("user_id", userId);
  const ratings = (data ?? []).map((r) => r.rating);
  const rating = ratings.length ? Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length) : BASELINE_RATING;
  const tier = getTier(rating);
  const progressToNextTier = tier.max >= 9999 ? 100 : Math.round(((rating - tier.min) / (tier.max - tier.min)) * 100);
  return { rating, tier, progressToNextTier };
}
