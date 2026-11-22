/**
 * Skill tiers for learning content. A tier is earned by proof, never by year or by clicking: the year only suggests where to start.
 * Content stays readable at every tier; what the previous tier's proof gates is the NEXT tier's proof (badge and unlocks).
 */
export const TIERS = [
  { n: 1, key: "basic", label: "Basic skills", year: 1 },
  { n: 2, key: "foundation", label: "Foundation skills", year: 2 },
  { n: 3, key: "intermediate", label: "Intermediate skills", year: 3 },
  { n: 4, key: "expert", label: "Expert skills", year: 4 },
] as const;
export type TierNumber = (typeof TIERS)[number]["n"];

/** Share of a tier's proof problems that must pass (hidden tests, any language the student picks). */
export const TIER_PASS_PCT = 70;

/** Pure. The tier to suggest for a year of study; an unknown year starts at Basic, a year past the last stays at Expert. */
export function suggestedTier(year: number | null): TierNumber {
  if (year == null || year <= 1) return 1;
  return Math.min(year, 4) as TierNumber;
}

/** Pure. Whether the proof test of `tier` may be attempted, given the tiers already proven. Tier 1 is always open; others need the one below. */
export function canAttemptTier(tier: TierNumber, proven: readonly TierNumber[]): boolean {
  return tier === 1 || proven.includes((tier - 1) as TierNumber);
}

/** Pure. The tier a student is working on: the first one not yet proven; null when all four are. */
export function currentTier(proven: readonly TierNumber[]): TierNumber | null {
  return TIERS.find((t) => !proven.includes(t.n))?.n ?? null;
}

/** Pure. Whether a proof attempt passes: at least TIER_PASS_PCT of the problems, and there must be problems to pass. */
export function tierPassed(passed: number, total: number): boolean {
  return total > 0 && passed >= 0 && passed <= total && (passed / total) * 100 >= TIER_PASS_PCT;
}

export type TierStatus = "proven" | "open" | "locked";
export interface TierRow { n: TierNumber; label: string; year: number; status: TierStatus; suggested: boolean }

/** Pure. The four tiers as a student sees them: proven, open to attempt (the one below is proven), or locked; the year's tier is marked suggested. */
export function tierRows(proven: readonly TierNumber[], year: number | null): TierRow[] {
  const suggested = suggestedTier(year);
  return TIERS.map((t) => ({ n: t.n, label: t.label, year: t.year, suggested: t.n === suggested, status: proven.includes(t.n) ? "proven" : canAttemptTier(t.n, proven) ? "open" : "locked" }));
}
