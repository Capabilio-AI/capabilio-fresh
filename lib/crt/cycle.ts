import { branchMatches } from "@/lib/org/branch-scope";

export type CycleStatus = "upcoming" | "open" | "closed";

export interface CycleWindow {
  opensOn: string;
  closesOn: string;
  branches: readonly string[] | null;
  years: readonly number[] | null;
}

/** Pure. Dates are YYYY-MM-DD; a cycle is open on both its first and last day. */
export function cycleStatus(c: Pick<CycleWindow, "opensOn" | "closesOn">, today: string): CycleStatus {
  if (today < c.opensOn) return "upcoming";
  return today > c.closesOn ? "closed" : "open";
}

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

/** Pure. The suggested window for the next cycle: starts six months after the last one opened (or `today`), open for two weeks. */
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
