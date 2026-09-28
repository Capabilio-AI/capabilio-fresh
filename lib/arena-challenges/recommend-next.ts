export interface RecommendableChallenge {
  id: string;
  difficulty: string;
  created_at: string;
}

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * Pure. The "Continue" card is a shortcut, not a gate -- every unsolved
 * challenge is already pickable directly from the grid. This just
 * recommends the easiest, oldest unsolved one first, so a new student
 * isn't handed a hard problem as their first suggestion.
 */
export function recommendNextChallenge(pool: RecommendableChallenge[], solvedIds: Set<string>): RecommendableChallenge | null {
  const unsolved = pool.filter((c) => !solvedIds.has(c.id));
  if (unsolved.length === 0) return null;

  return [...unsolved].sort((a, b) => {
    const diff = (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1);
    if (diff !== 0) return diff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}
