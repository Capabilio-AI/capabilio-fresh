import { branchMatches } from "@/lib/org/branch-scope";

export type CycleStatus = "upcoming" | "open" | "closed";

export interface CycleWindow {
  branches: readonly string[] | null;
  years: readonly number[] | null;
}

/** Pure. A cycle is open from the instant the placement cell set until the instant it closes. */
export function cycleStatusAt(c: { opensAt: string; closesAt: string }, now: Date): CycleStatus {
  const t = now.getTime();
  if (t < Date.parse(c.opensAt)) return "upcoming";
  return t > Date.parse(c.closesAt) ? "closed" : "open";
}

/** One minute per question, always: the time for a test is its number of questions in minutes. */
export const SECONDS_PER_QUESTION = 60;

/** Pure. Whether a student of this branch and year is expected to take the cycle (null scope = everyone). */
export function appliesTo(c: Pick<CycleWindow, "branches" | "years">, branch: string | null, yearOfStudy: number | null): boolean {
  const branchOk = !c.branches?.length || c.branches.some((b) => branchMatches(b, branch));
  const yearOk = !c.years?.length || (yearOfStudy !== null && c.years.includes(yearOfStudy));
  return branchOk && yearOk;
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Pure. The suggested window for the next cycle: starts six months after the last one opened (or `today`), open for two weeks. Dates only; the form adds the times. */
export function suggestNextWindow(lastOpensOn: string | null, today: string): { opensOn: string; closesOn: string } {
  const base = lastOpensOn ?? today;
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 6);
  const sixMonthsOn = d.toISOString().slice(0, 10);
  const opensOn = lastOpensOn && sixMonthsOn > today ? sixMonthsOn : lastOpensOn ? today : sixMonthsOn;
  return { opensOn, closesOn: addDays(opensOn, 14) };
}

/** Pure. A started attempt is over at its deadline; the student may not answer after it (a small grace covers a slow network). */
export const ATTEMPT_GRACE_SECONDS = 15;
export const attemptExpired = (deadlineAt: string, now: Date): boolean => now.getTime() > Date.parse(deadlineAt) + ATTEMPT_GRACE_SECONDS * 1000;

/** Pure. Form defaults for a suggested window: opens at 10:00 and closes at 18:00 (datetime-local format, India time as typed by the user). */
export const defaultTimes = (w: { opensOn: string; closesOn: string }): { opensAt: string; closesAt: string } => ({ opensAt: `${w.opensOn}T10:00`, closesAt: `${w.closesOn}T18:00` });
