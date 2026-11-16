/** A working professional has this long, from sign-up, to be verified with EPFO. */
export const VERIFY_WINDOW_DAYS = 7;

const DAY = 86_400_000;

/** The same window when the deadline is already stored. */
export function windowFromDeadline(deadline: string, now: Date = new Date()): VerifyWindow | null {
  const end = Date.parse(deadline);
  if (Number.isNaN(end)) return null;
  return { deadline: new Date(end).toISOString(), daysLeft: Math.max(0, Math.ceil((end - now.getTime()) / DAY)), overdue: now.getTime() >= end };
}

export interface VerifyWindow { deadline: string; daysLeft: number; overdue: boolean }

/** The sign-up moment plus the window. `daysLeft` rounds up, so the last day still reads as one day; it is never negative. */
export function verifyWindow(createdAt: string, now: Date = new Date()): VerifyWindow | null {
  const start = Date.parse(createdAt);
  if (Number.isNaN(start)) return null;
  const end = start + VERIFY_WINDOW_DAYS * DAY;
  return { deadline: new Date(end).toISOString(), daysLeft: Math.max(0, Math.ceil((end - now.getTime()) / DAY)), overdue: now.getTime() >= end };
}
