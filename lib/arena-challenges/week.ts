const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure. ISO date (YYYY-MM-DD) of the Monday on or before `date` — the anchor for "this week". */
export function weekStartOf(date: Date): string {
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

export function currentWeekStart(): string {
  return weekStartOf(new Date());
}

/** Pure. Whole weeks between two week-start dates (both must be Monday-anchored ISO dates). */
export function weeksBetween(earlier: string, later: string): number {
  return Math.round((new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime()) / (7 * DAY_MS));
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Pure. ISO date of the Sunday (India time) on or before `date`. A Stream week, and its wheel spin, starts at Sunday 00:00 IST.
 * Streaks and the Domain track keep their own Monday anchor (weekStartOf).
 */
export function streamWeekStartOf(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const sunday = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - ist.getUTCDay()));
  return sunday.toISOString().slice(0, 10);
}

export const currentStreamWeek = () => streamWeekStartOf(new Date());
