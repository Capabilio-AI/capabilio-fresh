// Ported from Capabilio-new's useDomainChallengeSlots.js pickNextChallenge —
// the same validated 4-tier fallback selection, adapted to this codebase's
// schema. Pure: the server runs this once a slot is eligible to spin, then
// the client's wheel animation reveals the already-decided result — the
// wheel never picks anything itself.

export interface RotationChallenge {
  id: string;
  category: string;
}

export interface SlotHistory {
  recentChallengeIds: string[];
  recentCategories: string[];
}

const RECENT_IDS_LIMIT = 3;
const RECENT_CATEGORIES_LIMIT = 4;

/**
 * Prefers a challenge that is both a different category from recent picks
 * and not recently completed; falls back in three more permissive tiers
 * rather than ever returning nothing when the pool is small. Returns null
 * only when the catalog itself is empty.
 */
export function pickNextChallenge(pool: RotationChallenge[], history: SlotHistory): RotationChallenge | null {
  if (pool.length === 0) return null;

  const unseen = pool.filter((c) => !history.recentChallengeIds.includes(c.id));
  const differentCategory = pool.filter((c) => !history.recentCategories.includes(c.category));

  const tier1 = differentCategory.filter((c) => unseen.includes(c));
  if (tier1.length > 0) return tier1[0];

  if (differentCategory.length > 0) return differentCategory[0];
  if (unseen.length > 0) return unseen[0];

  // Full cycle exhausted -- everything is eligible again, matching
  // Capabilio-new's memory-reset behavior on full-cycle completion.
  return pool[0];
}

/** Pure. Appends a completed pick to the slot's rolling history, capped so the tiers above can't lock up on a large pool's full history. */
export function advanceHistory(history: SlotHistory, completed: RotationChallenge): SlotHistory {
  return {
    recentChallengeIds: [completed.id, ...history.recentChallengeIds].slice(0, RECENT_IDS_LIMIT),
    recentCategories: [completed.category, ...history.recentCategories].slice(0, RECENT_CATEGORIES_LIMIT),
  };
}
