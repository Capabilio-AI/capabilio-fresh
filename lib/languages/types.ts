import type { TheoryLesson } from "@/lib/skillstudio/lesson-content";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { PageDoc } from "./html-check";

/** A language track: authored once, the same for every student. Lessons reuse the SkillStudio theory shape so the same reader renders them. */
export interface TrackLesson {
  key: string;
  title: string;
  minutes: number;
  lesson: TheoryLesson;
}
/**
 * The one problem that proves a module, together with its assessment. Plain standard-input to standard-output, so the student may solve it in the
 * track's own language. `reference` is a Python solution that CI runs on every test, so an expected output that is wrong cannot be published.
 */
export interface ModuleChallenge {
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  /** every test, the examples first; stdin and the exact stdout */
  tests: { input: string; output: string }[];
  /** how many of the first tests are shown to the student as examples; the rest stay hidden */
  exampleCount: number;
  /** a sentence for each example, in order */
  explanations: string[];
  reference: string;
}

/**
 * A SQL module problem. In "query" mode the student writes one SELECT and its result is compared with the reference query's; in "script" mode the student
 * writes statements (CREATE, ALTER, UPDATE, DELETE, INDEX) and the probes, read-only queries run afterwards, must see what the reference script left behind.
 * Each is run on every dataset: the first is shown to the student, the others are hidden variants with the same tables and different rows, so an answer
 * that only fits the visible rows fails. The expected result is never stored: it is the reference run on the same data.
 */
export interface SqlChallenge {
  kind: "sql";
  title: string;
  statement: string;
  mode: "query" | "script";
  /** datasets[0] is shown; the rest are hidden */
  datasets: Dataset[][];
  /** query mode: the order of the rows is part of the answer */
  ordered: boolean;
  reference: string;
  /** script mode: read-only queries that look at the result of the script */
  probes: string[];
  starter: string;
  /** wrong answers a student plausibly gives; CI checks that each one is told apart from the reference on some dataset */
  commonMistakes: string[];
}
/** One thing a student's page must do, in words the student reads, with the check that decides it (server side only). */
export interface PageRequirement { text: string; test: (d: PageDoc) => boolean }

/**
 * An HTML or CSS module problem. The student writes a page; it is read once and every requirement is checked, like a list of unit tests for a page.
 * The requirements are shown to the student word for word. `reference` is a page that must meet them all and each `commonMistakes` page must fail at least one (CI).
 */
export interface HtmlChallenge {
  kind: "html";
  title: string;
  statement: string;
  /** the editor opens with this: a skeleton, or the page to style */
  starter: string;
  requirements: PageRequirement[];
  reference: string;
  commonMistakes: string[];
}
export type AnyChallenge = ModuleChallenge | SqlChallenge | HtmlChallenge;
export const isSqlChallenge = (c: AnyChallenge): c is SqlChallenge => "kind" in c && c.kind === "sql";
export const isHtmlChallenge = (c: AnyChallenge): c is HtmlChallenge => "kind" in c && c.kind === "html";

export interface TrackModule {
  key: string;
  title: string;
  summary: string;
  lessons: TrackLesson[];
  /** the problem that proves this module; a module without one is proven by its assessment alone, and the module page says so */
  challenge?: AnyChallenge;
}
export interface Track {
  key: "c" | "java" | "python" | "cpp" | "sql" | "html" | "javascript" | "csharp";
  title: string;
  /** the Wandbox/Judge0 language id used by the code runner */
  runnerLanguage: "c" | "java" | "python" | "cpp" | "sql" | "html" | "javascript" | "csharp";
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

/** Attaches each module's proving problem, by module key, to the modules that have one. */
export const withChallenges = (modules: TrackModule[], byKey: Readonly<Record<string, AnyChallenge>>): TrackModule[] =>
  modules.map((m) => (byKey[m.key] ? { ...m, challenge: byKey[m.key] } : m));
