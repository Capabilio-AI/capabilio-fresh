import { programLengthYears } from "./years";

/** Plan B (second career choice and its baseline questions) is offered in exactly this term — 3-1 — and neither before nor after. */
export const PLAN_B_TERM = { year: 3, semester: 1 } as const;

export function isPlanBTerm(year: number | null, semester: number | null): boolean {
  return year === PLAN_B_TERM.year && semester === PLAN_B_TERM.semester;
}

/** Launchpad opens when the final year begins (4-1 for a 4-year program) and stays open through it. */
export function isLaunchpadOpen(year: number | null, startYear: number | null, endYear: number | null): boolean {
  return year != null && startYear != null && endYear != null && year >= programLengthYears(startYear, endYear);
}
