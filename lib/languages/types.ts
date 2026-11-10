import type { TheoryLesson } from "@/lib/skillstudio/lesson-content";

/** A language track: authored once, the same for every student. Lessons reuse the SkillStudio theory shape so the same reader renders them. */
export interface TrackLesson {
  key: string;
  title: string;
  minutes: number;
  lesson: TheoryLesson;
}
export interface TrackModule {
  key: string;
  title: string;
  summary: string;
  lessons: TrackLesson[];
}
export interface Track {
  key: "c" | "java" | "python" | "cpp" | "sql";
  title: string;
  /** the Wandbox/Judge0 language id used by the code runner */
  runnerLanguage: "c" | "java" | "python" | "cpp" | "sql";
  tagline: string;
  /** who it is for and what they can do after it */
  outcome: string;
  /** where the lessons come from, shown on the track page */
  references: { title: string; url: string }[];
  modules: TrackModule[];
}

type Check = TheoryLesson["check"][number];
type Section = TheoryLesson["sections"][number];

/** Authoring helper: one multiple-choice check. */
export const q = (question: string, options: [string, string, string, string], answerIndex: 0 | 1 | 2 | 3, why: string): Check => ({ question, options, answerIndex, why });

/** Authoring helper: a section; `code` is a complete program that the tests compile and run. */
export const sec = (heading: string, paragraphs: string[], example?: { title: string; code?: string; explanation: string }): Section => ({
  heading,
  paragraphs,
  example: example ? { title: example.title, code: example.code ?? null, explanation: example.explanation } : null,
});

/** Authoring helper: one lesson. */
export function lesson(key: string, title: string, minutes: number, l: Omit<TheoryLesson, "mistakes"> & { mistakes?: string[] }): TrackLesson {
  return { key, title, minutes, lesson: { mistakes: [], ...l } };
}

export const allLessons = (t: Track): TrackLesson[] => t.modules.flatMap((m) => m.lessons);
