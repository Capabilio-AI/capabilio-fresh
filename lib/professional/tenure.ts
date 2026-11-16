import type { TimelineRole, VerificationTier } from "./types";

/** Months of verified work needed to be invited to mentor: ten years. */
export const MENTOR_MIN_MONTHS = 120;
/** Only these tiers count toward mentor eligibility; self-claimed and colleague-confirmed roles do not. */
const COUNTS_FOR_MENTORING: ReadonlySet<VerificationTier> = new Set(["epfo", "work_email", "payslip"]);

const DAY = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Whole months of verified work, with overlapping jobs counted once and gaps not counted. */
export function verifiedMonths(roles: readonly TimelineRole[], now: Date = new Date()): number {
  const spans = roles
    .filter((r) => COUNTS_FOR_MENTORING.has(r.tier))
    .map((r) => [toMs(r.start), r.end ? toMs(r.end) : now.getTime()] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let days = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of spans) {
    if (s > curEnd) {
      if (curEnd > curStart) days += (curEnd - curStart) / DAY;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) curEnd = e;
  }
  if (curEnd > curStart) days += (curEnd - curStart) / DAY;
  return Math.floor(days / 30.4375);
}

export interface MentorEligibility {
  eligible: boolean;
  months: number;
  monthsToGo: number;
}

export function mentorEligibility(roles: readonly TimelineRole[], now: Date = new Date()): MentorEligibility {
  const months = verifiedMonths(roles, now);
  return { eligible: months >= MENTOR_MIN_MONTHS, months, monthsToGo: Math.max(0, MENTOR_MIN_MONTHS - months) };
}

/** A role can be offered as a mentoring role only if it was verified and lasted at least a year. */
export function mentorableRoles(roles: readonly TimelineRole[], now: Date = new Date()): TimelineRole[] {
  return roles.filter((r) => COUNTS_FOR_MENTORING.has(r.tier) && verifiedMonths([r], now) >= 12);
}

/**
 * The date verified work reached the mentor milestone, or the projected date if they are still short and in a verified current job.
 * Null when it was not reached and cannot be projected (no verified current role).
 */
export function mentorUnlockDate(roles: readonly TimelineRole[], now: Date = new Date()): { date: Date; reached: boolean } | null {
  const spans = roles
    .filter((r) => COUNTS_FOR_MENTORING.has(r.tier))
    .map((r) => [toMs(r.start), r.end ? toMs(r.end) : now.getTime()] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const target = MENTOR_MIN_MONTHS * 30.4375 * DAY;
  let acc = 0;
  let covered = -Infinity; // everything before this instant is already counted
  for (const [s, e] of spans) {
    const from = Math.max(s, covered);
    if (e <= from) continue;
    if (acc + (e - from) >= target) return { date: new Date(from + (target - acc)), reached: true };
    acc += e - from;
    covered = e;
  }
  const currentVerified = roles.some((r) => COUNTS_FOR_MENTORING.has(r.tier) && r.end === null);
  return currentVerified ? { date: new Date(now.getTime() + (target - acc)), reached: false } : null;
}
