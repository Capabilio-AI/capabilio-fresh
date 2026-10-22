/** The submit route is capped at 60 s (app/api/arena/domain/attempts/[attemptId]/submit/route.ts); a lock older than this belongs to a dead request. */
export const GRADING_LOCK_TTL_MS = 120_000;

/** Pure. The cut-off before which a "grading" lock (stamped in submitted_at when taken) is stale and may be taken over. */
export function staleGradingCutoff(now: Date): string {
  return new Date(now.getTime() - GRADING_LOCK_TTL_MS).toISOString();
}
