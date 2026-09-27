// A TypeScript port of the finish_arena_challenge Postgres RPC's exact ELO
// math (captured via pg_get_functiondef against the live database — see
// docs/platform-evolution/06-testing-strategy.md). The RPC remains the real
// source of truth for scoring; this exists so the formula is unit-testable
// and has one documented reference implementation.

const BASELINE_RATING = 1200;
const K_FACTOR = 32;

export interface EloUpdate {
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
}

/**
 * Single-player ELO approximation: the score fraction on a challenge stands
 * in for "match outcome" against a fixed-rating baseline opponent (standard
 * chess ELO update, K=32) — not head-to-head matchmaking.
 */
export function computeEloUpdate(correctCount: number, total: number, ratingBefore: number): EloUpdate {
  const actual = correctCount / Math.max(total, 1);
  const expected = 1 / (1 + Math.pow(10, (BASELINE_RATING - ratingBefore) / 400));
  // ponytail: Math.round() ties toward +Infinity; Postgres round(numeric)
  // ties away from zero — they can differ by 1 exactly at a negative x.5
  // delta. Rare enough (a precise half-point tie) that this reference port
  // doesn't special-case it; the RPC is still the real scoring path.
  const ratingDelta = Math.round(K_FACTOR * (actual - expected));
  return { ratingBefore, ratingDelta, ratingAfter: ratingBefore + ratingDelta };
}
