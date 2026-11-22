import type { TheoryLesson } from "@/lib/skillstudio/lesson-content";
import { allLessons, type Track } from "./types";

/**
 * A lesson as the browser may hold it: the check questions without their answers or explanations. A module's assessment is drawn from these very
 * questions, so shipping their answers with the page would let a student read the test's answers out of the page data. The server marks each answer
 * instead (app/api/languages/check) and reveals the explanation only after the student has answered.
 */
export type PublicLesson = Omit<TheoryLesson, "check"> & { check: { question: string; options: string[] }[] };

export const publicLesson = (l: TheoryLesson): PublicLesson => ({ ...l, check: l.check.map(({ question, options }) => ({ question, options })) });

export interface CheckVerdict { correct: boolean; answerIndex: number; why: string; moduleKey: string }

/** Pure. Marks one answer to one check question; null when the lesson or the question does not exist. */
export function gradeLessonCheck(track: Track, lessonKey: string, index: number, choice: number): CheckVerdict | null {
  const lesson = allLessons(track).find((l) => l.key === lessonKey);
  const q = lesson?.lesson.check[index];
  const m = track.modules.find((x) => x.lessons.some((l) => l.key === lessonKey));
  if (!lesson || !q || !m) return null;
  return { correct: choice === q.answerIndex, answerIndex: q.answerIndex, why: q.why, moduleKey: m.key };
}
