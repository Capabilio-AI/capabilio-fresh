export const DEFAULT_ACADEMIC_START_MONTH = 7;

export interface AcademicYearInput {
  startYear: number | null;
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
  if (input.override != null) return { year: input.override, source: "override" };
  if (input.startYear == null) return null;
  const start = academicYearStart(input.now ?? new Date(), input.cycleStartMonth ?? DEFAULT_ACADEMIC_START_MONTH);
  return { year: Math.max(1, start - input.startYear + 1), source: "computed" };
}
