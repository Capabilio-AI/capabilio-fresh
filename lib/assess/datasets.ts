// Open datasets that fill the common assessment: downloaded once, validated like any other question and stored in the pool.
// Pure mapping lives here (tested); the download and insert live in scripts/assess-import.mts.
import { createHash } from "node:crypto";
import type { Difficulty } from "./config";

export interface RawQuestion {
  question: string;
  /** every option, correct one included */
  options: string[];
  /** exact text of the correct option */
  answer: string;
  explanation?: string;
}

export interface DatasetSource {
  /** pool.model / pool.dataset value */
  dataset: string;
  license: string;
  section: string;
  /** datasets-server coordinates */
  hf: string;
  config: string;
  split: string;
  /** how to read a row into a question; null to skip it */
  read: (row: Record<string, unknown>) => RawQuestion | null;
  /** difficulty of an accepted question (a fixed level, or derived from the text) */
  level: Difficulty | ((q: RawQuestion) => Difficulty);
  /** upper bound on stored questions from this source */
  max: number;
}

const NOT_BASIC = /\b(None of these|All of these|none of the above)\b/i;
const strip = (s: string) => s.replace(/^\s*[A-E]\s*[).:]\s*/, "").trim();

/** MMLU rows: question, choices[4], answer index. */
export const readMmlu = (r: Record<string, unknown>): RawQuestion | null => {
  const choices = r.choices as string[] | undefined;
  const a = r.answer as number | undefined;
  if (!Array.isArray(choices) || choices.length !== 4 || typeof a !== "number" || !choices[a]) return null;
  return { question: String(r.question), options: choices.map(String), answer: String(choices[a]) };
};

/** ARC rows: question, choices {text[], label[]}, answerKey. Only 4-option rows (the pool shape). */
export const readArc = (r: Record<string, unknown>): RawQuestion | null => {
  const c = r.choices as { text: string[]; label: string[] } | undefined;
  const i = c?.label.indexOf(String(r.answerKey)) ?? -1;
  if (!c || c.text.length !== 4 || i < 0) return null;
  return { question: String(r.question), options: c.text, answer: c.text[i] };
};

/** AQuA-RAT rows: 5 options "A)..." and a letter. Keeps the key plus three distractors, chosen deterministically. */
export const readAqua = (r: Record<string, unknown>): RawQuestion | null => {
  const raw = (r.options as string[] | undefined)?.map(strip);
  const key = ["A", "B", "C", "D", "E"].indexOf(String(r.correct));
  if (!raw || raw.length !== 5 || key < 0) return null;
  if (raw.some((o) => NOT_BASIC.test(o))) return null;
  const question = String(r.question);
  const rationale = String(r.rationale ?? "").replace(/\s+/g, " ").trim();
  const wrong = raw
    .filter((_, i) => i !== key)
    .sort((x, y) => hash(question + x).localeCompare(hash(question + y)))
    .slice(0, 3);
  return { question, options: [...wrong, raw[key]], answer: raw[key], explanation: rationale.length >= 20 && rationale.length <= 1000 ? rationale : undefined };
};

const hash = (s: string) => createHash("sha1").update(s).digest("hex");

/** Shorter stems are easier; thirds of the length range map to EASY / MEDIUM / HARD. */
export const byLength = (easyBelow: number, mediumBelow: number) => (q: RawQuestion): Difficulty =>
  q.question.length < easyBelow ? "EASY" : q.question.length < mediumBelow ? "MEDIUM" : "HARD";

const mmlu = (config: string, section: string, level: DatasetSource["level"], max: number): DatasetSource =>
  ({ dataset: `cais/mmlu:${config}`, license: "MIT", section, hf: "cais/mmlu", config, split: "test", read: readMmlu, level, max });

export const SOURCES: readonly DatasetSource[] = [
  { dataset: "deepmind/aqua_rat", license: "Apache-2.0", section: "quantitative_aptitude", hf: "deepmind/aqua_rat", config: "raw", split: "test", read: readAqua, level: byLength(130, 230), max: 120 },
  mmlu("elementary_mathematics", "engineering_mathematics", "EASY", 60),
  mmlu("high_school_mathematics", "engineering_mathematics", "MEDIUM", 60),
  mmlu("college_mathematics", "engineering_mathematics", "HARD", 40),
  mmlu("high_school_computer_science", "programming_fundamentals", byLength(150, 330), 100),
  mmlu("college_computer_science", "programming_fundamentals", "HARD", 40),
  mmlu("logical_fallacies", "logical_reasoning", "MEDIUM", 40),
  mmlu("conceptual_physics", "basic_sciences", "EASY", 40),
  mmlu("high_school_physics", "basic_sciences", "MEDIUM", 40),
  mmlu("high_school_chemistry", "basic_sciences", "MEDIUM", 40),
  { dataset: "allenai/ai2_arc:ARC-Easy", license: "CC-BY-SA-4.0", section: "basic_sciences", hf: "allenai/ai2_arc", config: "ARC-Easy", split: "test", read: readArc, level: "EASY", max: 60 },
  { dataset: "allenai/ai2_arc:ARC-Challenge", license: "CC-BY-SA-4.0", section: "basic_sciences", hf: "allenai/ai2_arc", config: "ARC-Challenge", split: "test", read: readArc, level: "MEDIUM", max: 40 },
];

/** The shape validateQuestion expects, so dataset questions pass through the same checks as generated ones. */
export function toGenerated(q: RawQuestion, section: string, label: string, difficulty: Difficulty) {
  return {
    question: q.question.trim(),
    options: q.options.map((o) => o.trim()),
    skill: label,
    skillId: section,
    careerRole: "General",
    difficulty,
    type: "concept" as const,
    correctAnswer: q.answer.trim(),
    explanation: q.explanation ?? `The correct answer is: ${q.answer.trim()}.`,
    estimatedTimeSeconds: 45,
  };
}
