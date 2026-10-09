// Pure Arena rules (kept apart from arena.ts so they can be tested without a database client).

/** Harder challenges are worth more: base rule delta x this. Assessment answers always use 1. */
export const ARENA_DIFFICULTY_SCALE = { easy: 1, medium: 2, hard: 3 } as const;
/** The roadmap is refreshed when a pass carries the rating across a multiple of this (450, 500, ...). */
export const ROADMAP_ELO_MILESTONE = 50;

export const crossedMilestone = (previous: number, next: number, step = ROADMAP_ELO_MILESTONE) => Math.floor(next / step) > Math.floor(previous / step);

