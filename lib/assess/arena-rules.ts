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
 * A wrong answer costs rating. The ARENA rule's incorrect delta is half its correct delta, so a miss on a ticket costs half of what solving it earns: a task
 * worth +8 costs -4 per wrong answer. That is the ELO shape: a guess is only worth making if you expect to be right more than a third of the time.
 */
export const MISS_COST_FRACTION = 0.5;
/** Only the first few wrong answers on one ticket cost anything, so one hard ticket cannot bury a student, and a skip counts as one of them. */
export const MAX_CHARGED_MISSES = 3;

/** The rating a wrong answer costs on a ticket worth `elo`, as a positive number to show a student (the ledger applies it as a negative). */
export const missCost = (elo: number): number => Math.round(elo * MISS_COST_FRACTION);

/** Whether the nth submission (1 for the first) on a ticket is one that costs rating when wrong. */
export const missIsCharged = (submissionNumber: number): boolean => submissionNumber >= 1 && submissionNumber <= MAX_CHARGED_MISSES;
