export const SUBMIT_GRACE_SECONDS = 30;
export const MAX_DRAFT_BYTES = 200_000;

export const expiresAtFor = (startedAt: Date, timeLimitMinutes: number): Date => new Date(startedAt.getTime() + timeLimitMinutes * 60_000);

/** Pure. A submit up to SUBMIT_GRACE_SECONDS after the deadline still counts (network latency); later is EXPIRED. */
export const isPastDeadline = (expiresAt: Date | string, now: Date): boolean => now.getTime() > new Date(expiresAt).getTime() + SUBMIT_GRACE_SECONDS * 1000;

/** Pure. Whole seconds spent, capped at the time limit so a late submit cannot report more than was allowed. */
export function timeSpentSeconds(startedAt: Date | string, now: Date, timeLimitMinutes: number): number {
  const elapsed = Math.max(0, Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000));
  return Math.min(elapsed, timeLimitMinutes * 60);
}

/** Pure. Total score penalty for the first `used` hints, in hint order. */
export function hintPenalty(hints: { hint_order: number; penalty_points: number }[], used: number): number {
  return [...hints].sort((a, b) => a.hint_order - b.hint_order).slice(0, used).reduce((n, h) => n + h.penalty_points, 0);
}

export type AttemptStatus = "IN_PROGRESS" | "PASSED" | "FAILED" | "NEEDS_REVIEW" | "EXPIRED" | "ABANDONED";
const FINAL: AttemptStatus[] = ["PASSED", "FAILED", "NEEDS_REVIEW", "EXPIRED", "ABANDONED"];
/** Pure. Only an in-progress attempt can change; every final state is terminal. */
export const isFinal = (status: AttemptStatus): boolean => FINAL.includes(status);
