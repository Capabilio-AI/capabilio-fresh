import { z } from "zod";

/** Languages the code runner can run (see lib/code-execution/wandbox.ts) that a lesson example may be in. SQL has no runner, so it is not here. */
export type RunnableLanguage = "python" | "java" | "c" | "cpp" | "javascript" | "typescript";
/** Exercises are standard-input to standard-output programs, so they are offered where that works the same way in every case. */
export const EXERCISE_LANGUAGES: readonly RunnableLanguage[] = ["python", "java", "c", "cpp"];
/**
 * Pure. Where exercises are actually offered. The free shared runner compiles Java and C++ too slowly to verify exercises in a reasonable time
 * (a Java check took over fifteen minutes), so without a dedicated runner (JUDGE0_URL) only Python and C are offered.
 */
export const practiceLanguages = (dedicatedRunner: boolean): readonly RunnableLanguage[] => (dedicatedRunner ? EXERCISE_LANGUAGES : ["python", "c"]);
export const isExerciseLanguage = (l: string | null | undefined, dedicatedRunner = false): l is RunnableLanguage => practiceLanguages(dedicatedRunner).includes(l as RunnableLanguage);

/**
 * Pure. Models sometimes return a program on one line with literal backslash-n sequences where the line breaks should be, which no compiler
 * accepts. When there are no real line breaks but there are `\n` sequences, they are turned back into line breaks (and `\t` into tabs).
 */
export function restoreLineBreaks(code: string): string {
  if (code.includes("\n") || !/\\n/.test(code)) return code;
  return code.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

const BY_NAME: [RegExp, RunnableLanguage][] = [
  [/\btypescript\b/i, "typescript"],
  [/\bjavascript\b|\bnode\.?js\b/i, "javascript"],
  [/\bc\+\+|\bcpp\b/i, "cpp"],
  [/\bjava\b/i, "java"],
  [/\bpython\b/i, "python"],
  [/(^|[^a-z0-9+#])c( programming| language)?(?![a-z0-9+#])/i, "c"],
];

/**
 * Pure. The language a lesson's code is in: the topic name first, then the shape of the code. Null when it is not a language we can run,
 * so a lesson on structural analysis or SQL simply gets no Run button.
 */
export function runnableLanguage(topicTitle: string, code?: string | null): RunnableLanguage | null {
  for (const [re, lang] of BY_NAME) if (re.test(topicTitle)) return lang;
  if (!code) return null;
  if (/^\s*select\b|\bfrom\s+\w+\s+(where|join|group)/im.test(code)) return null;
  if (/#include\s*<(iostream|vector|string|algorithm)>|std::|cout\s*<</.test(code)) return "cpp";
  if (/#include\s*<stdio\.h>|\bprintf\s*\(/.test(code)) return "c";
  if (/System\.out\.|public\s+static\s+void\s+main/.test(code)) return "java";
  if (/console\.log\(|=>\s*[{(]|\bconst\s+\w+\s*=/.test(code)) return "javascript";
  if (/^\s*def\s+\w+\(|^\s*import\s+\w+|\bprint\(/m.test(code)) return "python";
  return null;
}

/** Pure. Output with Windows line ends, trailing spaces and trailing blank lines removed: what a person would call "the same output". */
export const normalizeOutput = (s: string): string => s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
export const outputsMatch = (got: string, expected: string): boolean => normalizeOutput(got) === normalizeOutput(expected);

export const ExerciseTest = z.object({ input: z.string().max(2000), expected: z.string().min(1).max(2000), hidden: z.boolean().default(false) });
export type ExerciseTest = z.infer<typeof ExerciseTest>;

/** What the model writes. No transforms: the AI layer turns this into JSON Schema. */
export const GeneratedExercises = z.object({
  exercises: z
    .array(
      z.object({
        title: z.string().min(3).max(100),
        instructions: z.string().min(20).max(900),
        starterCode: z.string().min(1).max(1500),
        solution: z.string().min(5).max(3000),
        tests: z.array(ExerciseTest).min(2).max(6).refine((t) => t.some((x) => !x.hidden), { message: "at least one test must be visible" }),
      })
    )
    .min(1)
    .max(4),
});
export type GeneratedExercise = z.infer<typeof GeneratedExercises>["exercises"][number];

export interface StoredExercise { id: string; title: string; instructions: string; language: RunnableLanguage; starterCode: string; solution: string; tests: ExerciseTest[] }
export interface PublicExercise { id: string; title: string; instructions: string; language: RunnableLanguage; starterCode: string; visibleTests: { input: string; expected: string }[]; hiddenTests: number }

/** Pure. What a student may see of an exercise: never the solution, and never the answers to the hidden tests. */
export function publicExercise(e: StoredExercise): PublicExercise {
  return {
    id: e.id, title: e.title, instructions: e.instructions, language: e.language, starterCode: e.starterCode,
    visibleTests: e.tests.filter((t) => !t.hidden).map((t) => ({ input: t.input, expected: t.expected })),
    hiddenTests: e.tests.filter((t) => t.hidden).length,
  };
}

export type TopicSource = { kind: "topic"; nodeKey: string } | { kind: "track"; track: string; lessonKey: string };
export const topicKeyFor = (s: TopicSource): string => (s.kind === "topic" ? `topic:${s.nodeKey}` : `track:${s.track}:${s.lessonKey}`);

const LANGUAGE_NAME: Record<RunnableLanguage, string> = { python: "Python 3", java: "Java 21 (class Main with public static void main)", c: "C (gcc, C17)", cpp: "C++ (g++, C++17)", javascript: "JavaScript (Node 20)", typescript: "TypeScript" };

export const EXERCISE_SYSTEM = `You write short coding exercises for beginners, in the style of a classroom tutorial. You answer with JSON only.
Every exercise is a complete program that reads ALL its input from standard input and prints its result to standard output. It must be fully deterministic: no randomness, no dates or times, no network or files, no reliance on locale. The same input always gives exactly the same output.
You also write the reference solution, and it must be correct: it will be executed against your tests, and an exercise whose solution fails any test is thrown away.`;

/** Pure. The ask for one lesson's exercises. */
export function exercisePrompt(input: { title: string; summary: string; language: RunnableLanguage }): string {
  return [
    `Lesson topic: "${input.title}".`,
    input.summary ? `What the lesson teaches: ${input.summary}` : null,
    `Language: ${LANGUAGE_NAME[input.language]}.`,
    "",
    "Write 2 exercises that practise exactly this topic, the second a little harder than the first. For each:",
    "- title: a short name.",
    "- instructions: what to read from standard input (state the exact input format) and what to print (state the exact output format), with one worked example.",
    "- starterCode: a skeleton that already reads the input and has a comment where the student's logic goes. It must compile or run but must NOT already produce the right answer.",
    "- solution: the complete correct program.",
    "- tests: 3 to 5 tests. Each has `input` (the exact standard input, ending with a newline), `expected` (the exact standard output, trimmed of trailing newlines) and `hidden`. Make the first two visible (hidden false) and the rest hidden (true), including at least one edge case.",
  ].filter((x): x is string => x !== null).join("\n");
}
