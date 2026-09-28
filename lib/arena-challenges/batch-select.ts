export interface BatchCandidate {
  id: string;
}

/**
 * Pure. Picks `taskCount` distinct challenges for this week's reveal,
 * preferring ones not used in the immediately preceding week so the same
 * batch doesn't repeat two weeks running. Falls back to reusing recent
 * challenges once the pool is smaller than what's needed, rather than
 * returning fewer than requested for no reason — and never returns more
 * than the pool actually has.
 */
export function pickWeeklyBatch(pool: BatchCandidate[], taskCount: number, previousWeekChallengeIds: string[]): string[] {
  const fresh = pool.filter((c) => !previousWeekChallengeIds.includes(c.id));
  const ordered = fresh.length >= taskCount ? fresh : [...fresh, ...pool.filter((c) => previousWeekChallengeIds.includes(c.id))];

  const picked: string[] = [];
  const seen = new Set<string>();
  for (const candidate of ordered) {
    if (picked.length >= taskCount) break;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picked.push(candidate.id);
  }
  return picked;
}
