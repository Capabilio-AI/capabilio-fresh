// Pure Arena rules (kept apart from arena.ts so they can be tested without a database client).

/** Harder challenges are worth more: base rule delta x this. Assessment answers always use 1. */
export const ARENA_DIFFICULTY_SCALE = { easy: 1, medium: 2, hard: 3 } as const;
/** The roadmap is refreshed when a pass carries the rating across a multiple of this (450, 500, ...). */
export const ROADMAP_ELO_MILESTONE = 50;

export const crossedMilestone = (previous: number, next: number, step = ROADMAP_ELO_MILESTONE) => Math.floor(next / step) > Math.floor(previous / step);


/** The ARENA rule's base delta in elo_rules. A pass worth N ELO on its ticket is applied with scale N / this, so the ledger moves by exactly what the student was shown. */
export const ARENA_BASE_DELTA = 4;
export const scaleForElo = (elo: number) => elo / ARENA_BASE_DELTA;

/**
 * What a ticket's answer is worth, by the answer. A right answer earns what the ticket advertised. A wrong one loses rating in proportion to how wrong it is:
 * the share of the task's checks it failed, taken out of what the ticket was worth. An answer that gets 2 of 3 checks right loses a third of the ticket's
 * worth; one that gets none right loses all of it. Nothing else enters: no flat penalty, no limit on how many, no multiplier. (The assessment's fixed
 * +4 / -2 rule is for assessment answers only.)
 */
export function failedShare(checks: readonly { passed: boolean }[]): number {
  if (checks.length === 0) return 1; // an answer that could not be checked at all counts as wholly wrong
  return checks.filter((c) => !c.passed).length / checks.length;
}

/** The (negative) rating change for a wrong answer on a ticket worth `worth`; always at least -1, since a wrong answer is never free. */
export function missChange(worth: number, checks: readonly { passed: boolean }[]): number {
  return -Math.max(1, Math.round(worth * failedShare(checks)));
}

/** What a pass raises the career ELO by: the ticket's own worth on the shared ladder (easy 4, medium 8, hard 12). */
export const careerPassGain = (difficulty: keyof typeof ARENA_DIFFICULTY_SCALE): number => ARENA_BASE_DELTA * ARENA_DIFFICULTY_SCALE[difficulty];
