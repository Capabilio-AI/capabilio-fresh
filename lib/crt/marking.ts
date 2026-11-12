import type { CrtModule } from "./model";

/** Marks taken off a wrong answer in every timed CRT test: cycle assessments, simulators and company mocks. A blank answer costs nothing. */
export const NEGATIVE_MARK = 0.25;

/** What the exam sends for a question left unanswered. */
export const SKIPPED_KEY = "-";

/**
 * Pure. The mark for one answer. Right/wrong questions: the point if right, minus `negative` if wrong, 0 if left blank. Soft-skills questions are judged
 * best-to-worst (3/2/1/0), so there is no "wrong" answer to penalise and they keep their points.
 */
export function markFor(module: CrtModule, points: number, answered: boolean, negative: number = NEGATIVE_MARK): number {
  if (!answered) return 0;
  return module !== "soft_skills" && points === 0 ? -negative : points;
}

/** Pure. A section's or a test's marks added up; negative marking can take it to zero but never below. */
export const totalMarks = (marks: readonly number[]): number => Math.max(0, Math.round(marks.reduce((s, m) => s + m, 0) * 100) / 100);

export const negativeMarkingNote = (negative: number = NEGATIVE_MARK): string => `Each wrong answer takes ${negative} of a mark off. A question left blank costs nothing, and soft-skills questions are not penalised.`;
