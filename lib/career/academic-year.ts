import { programLengthYears } from "./years";

export const DEFAULT_ACADEMIC_START_MONTH = 7;

export interface AcademicYearInput {
  startYear: number | null;
  endYear?: number | null;
  cycleStartMonth?: number;
  override?: number | null;
  now?: Date;
}

export interface AcademicYear {
  year: number;
  source: "override" | "computed";
}

/** Calendar year in which the academic cycle containing `date` began (cycle starts in `cycleStartMonth`, 1-12). */
export function academicYearStart(date: Date, cycleStartMonth: number): number {
  return date.getMonth() + 1 >= cycleStartMonth ? date.getFullYear() : date.getFullYear() - 1;
}

/**
 * Current year of study, bucketed by the institution's academic cycle (not
 * calendar Jan–Dec). Never trusted silently: callers show it for confirmation,
 * and a manual override always wins (backlogs, gap years, repeated years).
 */
export function computeCurrentAcademicYear(input: AcademicYearInput): AcademicYear | null {
  // A 2023–2027 program has 4 years: an override or a long-past start can't push past the final year.
  const last = input.startYear != null && input.endYear != null ? programLengthYears(input.startYear, input.endYear) : Infinity;
  if (input.override != null) return { year: Math.min(input.override, last), source: "override" };
  if (input.startYear == null) return null;
  const start = academicYearStart(input.now ?? new Date(), input.cycleStartMonth ?? DEFAULT_ACADEMIC_START_MONTH);
  return { year: Math.min(Math.max(1, start - input.startYear + 1), last), source: "computed" };
}

const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

/** "3rd Year · 2024–2028" — no semester claim (semester granularity was dropped). */
export function formatAcademicYear(year: number | null, startYear: number | null, endYear: number | null): string | null {
  if (year == null) return null;
  const label = `${ORDINALS[year] ?? `${year}th`} Year`;
  return startYear != null && endYear != null ? `${label} · ${startYear}–${endYear}` : label;
}
