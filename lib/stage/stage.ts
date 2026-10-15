import { DEFAULT_ACADEMIC_START_MONTH } from "@/lib/career/academic-year";

// The career stage is stored in profiles.student_status. The app path (nav, tabs, pages) follows it, and it only moves forward.
export const STAGES = ["student", "graduate", "professional"] as const;
export type CareerStage = (typeof STAGES)[number];

export const isStage = (v: unknown): v is CareerStage => typeof v === "string" && (STAGES as readonly string[]).includes(v);

/** Unknown or missing values behave as a current student, the account default. */
export const toStage = (v: unknown): CareerStage => (isStage(v) ? v : "student");

/** Graduates and professionals take the resume-first assessment: one role, no general layer. */
export const isPostStudy = (v: unknown): boolean => toStage(v) !== "student";

/** A profile can move forward (student, graduate, professional) or skip straight to professional, never back. */
export function canMove(from: CareerStage, to: CareerStage): boolean {
  return STAGES.indexOf(to) > STAGES.indexOf(from);
}

/**
 * Whether a programme ending in `endYear` is over. Cohorts finish when the cycle that would follow their last year begins
 * (a 2022-2026 batch is done once July 2026 arrives), so nobody is moved while still sitting their final exams.
 */
export function hasProgrammeEnded(endYear: number | null, now: Date = new Date(), cycleStartMonth: number = DEFAULT_ACADEMIC_START_MONTH): boolean {
  if (endYear == null) return false;
  const year = now.getFullYear();
  return year > endYear || (year === endYear && now.getMonth() + 1 >= cycleStartMonth);
}
