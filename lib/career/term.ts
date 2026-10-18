import { programLengthYears } from "./years";

/** Plan B (the career-direction question and its baseline checks) opens when 3rd year begins and stays open after; never before. */
export const PLAN_B_FIRST_YEAR = 3;

export function isPlanBTerm(year: number | null, semester: number | null): boolean {
  return year != null && semester != null && year >= PLAN_B_FIRST_YEAR;
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
