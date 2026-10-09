import { createHash } from "node:crypto";
import { z } from "zod";
import { DIFFICULTIES, QUESTION_TYPES, type Difficulty, type QuestionType } from "./config";

// Strict shape of one Groq-generated question. Anything that fails this OR the semantic checks below is rejected and
// regenerated; malformed output is never stored and never shown.
export const GeneratedQuestionSchema = z.object({
  question: z.string().trim().min(25).max(1500),
  options: z.array(z.string().trim().min(1).max(400)).length(4),
  skill: z.string().trim().min(1),
  skillId: z.string().trim().min(1),
  careerRole: z.string().trim().min(1),
  difficulty: z.enum(DIFFICULTIES),
  type: z.enum(QUESTION_TYPES),
  correctAnswer: z.string().trim().min(1).max(400),
  explanation: z.string().trim().min(20).max(1200),
  estimatedTimeSeconds: z.number().int().min(10).max(300),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const GeneratedBatchSchema = z.object({ questions: z.array(z.unknown()).min(1) });

/** What the question must be about; the generator asked for exactly this and the output has to agree. */
export interface Expectation {
  /** canonical skill key (career layer) or section key (general layer) */
  skillKey: string;
  careerKey: string | null;
  difficulty: Difficulty;
  /** extra floor on question length for scenario-style career questions (definitions are too short to be realistic) */
  minQuestionLength: number;
}

export interface ValidQuestion extends Omit<GeneratedQuestion, "options" | "correctAnswer"> {
  options: string[];
  correctIndex: number;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
// "All of the above" breaks once options are shuffled per attempt, and "none of the above" teaches test-taking, not skill
const POSITIONAL = /\b(all|none|both)\s+of\s+(the\s+)?(above|these)\b|\b(a|b|c|d)\s+and\s+(a|b|c|d)\b|\boption\s+[a-d]\b/i;

// Options are shuffled per attempt, so any text that points at a position ("Option 2", "choice B") would be wrong for most students
const POSITION_REFERENCE = /\b(option|choice)s?\s*[#(]?\s*([1-4]|[a-d])\b/i;

export type Verdict = { ok: true; question: ValidQuestion } | { ok: false; reason: string };

export function validateQuestion(raw: unknown, expect: Expectation): Verdict {
  const parsed = GeneratedQuestionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: `schema: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}` };
  const q = parsed.data;

  const seen = new Set<string>();
  for (const o of q.options) {
    const k = norm(o);
    if (seen.has(k)) return { ok: false, reason: "duplicate options" };
    seen.add(k);
    if (POSITIONAL.test(o)) return { ok: false, reason: "positional option (all/none of the above, option letters)" };
  }
  const correct = q.options.map((o, i) => (norm(o) === norm(q.correctAnswer) ? i : -1)).filter((i) => i >= 0);
  if (correct.length !== 1) return { ok: false, reason: "correctAnswer is not exactly one of the options" };

  if (norm(q.skillId) !== norm(expect.skillKey)) return { ok: false, reason: `skillId ${q.skillId} is not the requested skill ${expect.skillKey}` };
  // compare on letters/digits only so "AI/ML Engineer", "ai-ml-engineer" and "AI ML Engineer" are the same role
  const roleKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (expect.careerKey && !roleKey(q.careerRole).includes(roleKey(expect.careerKey))) {
    return { ok: false, reason: `careerRole ${q.careerRole} does not match ${expect.careerKey}` };
  }
  if (q.difficulty !== expect.difficulty) return { ok: false, reason: `difficulty ${q.difficulty} != requested ${expect.difficulty}` };
  if (q.question.length < expect.minQuestionLength) return { ok: false, reason: "question too short to be a realistic scenario" };
  if (POSITION_REFERENCE.test(q.explanation) || POSITION_REFERENCE.test(q.question)) return { ok: false, reason: "refers to an option by position" };
  if (norm(q.explanation) === norm(q.question)) return { ok: false, reason: "explanation just repeats the question" };

  const { correctAnswer: _answer, ...rest } = q;
  void _answer;
  return { ok: true, question: { ...rest, options: q.options, correctIndex: correct[0] } };
}

/**
 * Identity of a question for dedupe across students and batches: the normalised stem plus the skill it is filed under.
 * Reworded options do not make a new question; a different skill with the same stem does.
 */
export function contentHash(questionText: string, scopeKey: string): string {
  return createHash("sha256").update(`${norm(scopeKey)}|${norm(questionText).replace(/[^\p{L}\p{N} ]/gu, "")}`).digest("hex");
}

export type { QuestionType };
