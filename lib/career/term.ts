import { programLengthYears } from "./years";

/** Plan B (the career-direction question and its baseline checks) opens when 3rd year begins and stays open after; never before. */
export const PLAN_B_FIRST_YEAR = 3;

export function isPlanBTerm(year: number | null, semester: number | null): boolean {
  return year != null && semester != null && year >= PLAN_B_FIRST_YEAR;
}

/**
 * The college's own start date for semester 1 of a milestone year (3-1 for Plan B, 4-1 for Launchpad and AI Interview). When the college has entered that date
 * and it has not arrived yet, a student who is in that year but still before its first semester has not reached the milestone. Without a date, or once
 * the date has passed, or when the student is already in semester 2 or a later year, nothing changes: the year alone decides, as it always did.
 * A date more than MAX_HOLD_DAYS away is next cycle's date entered early, not a delay, so it holds nothing back (colleges re-enter dates each cycle).
 */
export const MAX_HOLD_DAYS = 120;
const DAY_MS = 86_400_000;

export function isFirstSemesterOpen(input: { year: number | null; semester: number | null; milestoneYear: number; firstSemesterStartsOn: string | null; today: string }): boolean {
  const { year, semester, milestoneYear, firstSemesterStartsOn, today } = input;
  if (year !== milestoneYear || semester !== 1 || !firstSemesterStartsOn) return true;
  if (firstSemesterStartsOn <= today) return true;
  return (Date.parse(firstSemesterStartsOn) - Date.parse(today)) / DAY_MS > MAX_HOLD_DAYS;
}

/** Stream challenges (the branch's own subjects) open at 2-1. Before that the student has the roadmap, SkillStudio and projects. An unknown year never locks anyone out. */
export const STREAM_FIRST_YEAR = 2;

export function isStreamTerm(year: number | null): boolean {
  return year == null || year >= STREAM_FIRST_YEAR;
}

/** Launchpad opens when the final year begins (4-1 for a 4-year program) and stays open through it. */
export function isLaunchpadOpen(year: number | null, startYear: number | null, endYear: number | null): boolean {
  return year != null && startYear != null && endYear != null && year >= programLengthYears(startYear, endYear);
}
