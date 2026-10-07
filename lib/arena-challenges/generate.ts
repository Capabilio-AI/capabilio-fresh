import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { completeJson } from "@/lib/ai/groq";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { IT_CLUSTER_SCOPE_KEY } from "./branch-clusters";
import { isNumericAnswerCorrect } from "./numeric-answer";

// Evaluation is always deterministic: code challenges use the same
// exact-output-match as the assessment engine's coding questions; numeric
// challenges compare against a value produced by *running* a hidden
// reference solution, never the model's own arithmetic.
const SUPPORTED_LANGUAGES = ["python", "c"] as const;

const BATCH_SIZE = 4;
const MIN_POOL_SIZE = 14;
const MAX_ATTEMPTS = 10;

const BaseFields = {
  title: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  scenario: z.string().min(1),
  objective: z.string().min(1),
  skill_tags: z.array(z.string().min(1)).min(1).max(5),
};

const CodeChallengeSchema = z.object({
  ...BaseFields,
  language: z.enum(SUPPORTED_LANGUAGES),
  starter_code: z.string().min(1),
  stdin: z.string().default(""),
  expected_output: z.string().min(1),
});

const NumericChallengeSchema = z.object({
  ...BaseFields,
  answer_unit: z.string().min(1),
  reference_solution: z.string().min(1),
});

type CodeChallenge = z.infer<typeof CodeChallengeSchema>;
type NumericChallenge = z.infer<typeof NumericChallengeSchema>;
type ChallengeInsert = Database["public"]["Tables"]["arena_challenges"]["Insert"];

function codeSystemPrompt(promptLabel: string): string {
  return `You write short, real, solvable coding challenges for a "${promptLabel}" student on a career-readiness
platform's Arena. These are Stream challenges: practical, curriculum-relevant programming problems (Python or C).

Respond with JSON only, matching this exact shape:
{
  "challenges": [
    {
      "title": "string",
      "category": "string (a short tag like 'Data Structures', 'Algorithms', 'Databases')",
      "difficulty": "easy" | "medium" | "hard",
      "scenario": "string -- 2-4 sentences setting up a realistic problem",
      "objective": "string -- exactly what the program must do",
      "language": "python" | "c",
      "starter_code": "string -- ONLY a bare skeleton: imports, the function/main signature, reading stdin if needed, and a single placeholder line (e.g. 'pass' or a TODO comment) where the real logic goes. It must NOT contain any part of the actual logic that solves the problem.",
      "stdin": "string -- sample input the program reads via stdin, or empty string if none",
      "expected_output": "string -- the EXACT stdout the correct solution must print for the given stdin, nothing else",
      "skill_tags": ["string", "..."]
    }
  ]
}

Critical: expected_output is checked with a plain string comparison. starter_code is run before being shown to
a student, and any challenge whose starter_code already prints expected_output is discarded. No markdown, no code
fences, valid JSON only.`;
}

function numericSystemPrompt(promptLabel: string): string {
  return `You write short, real, solvable calculation challenges for a "${promptLabel}" student on a
career-readiness platform's Arena. These are Stream challenges grounded in the ${promptLabel} curriculum: the
student works the problem out by hand (formulas, reasoning) and submits a single numeric answer with its unit.
They are NOT programming tasks -- never ask the student to write code.

Respond with JSON only, matching this exact shape:
{
  "challenges": [
    {
      "title": "string",
      "category": "string (a short ${promptLabel} topic, e.g. 'Strength of Materials', 'Thermodynamics')",
      "difficulty": "easy" | "medium" | "hard",
      "scenario": "string -- 2-4 sentences setting up a realistic ${promptLabel} problem, stating EVERY given value with its unit",
      "objective": "string -- exactly which single quantity to calculate, and to what unit",
      "answer_unit": "string -- the unit of the final answer, e.g. 'kN', 'mm', 'W', '%'",
      "reference_solution": "string -- a short standalone Python 3 program (standard library only) that computes the answer from the given values and prints ONLY the final number in answer_unit, nothing else",
      "skill_tags": ["string", "..."]
    }
  ]
}

Critical: the scenario must never reveal the answer or the finished calculation. reference_solution is hidden from
the student and is executed to produce the official answer. No markdown, no code fences, valid JSON only.`;
}

async function generateBatch<T extends z.ZodTypeAny>(schema: T, systemPrompt: string, batchSize: number, avoidTitles: string[]): Promise<z.infer<T>[]> {
  const avoid = avoidTitles.length > 0 ? `\n\nDo not repeat or closely rephrase any of these already-used titles:\n- ${avoidTitles.join("\n- ")}` : "";
  const result = await completeJson(`Generate ${batchSize} challenges.${avoid}`, systemPrompt, z.object({ challenges: z.array(schema).min(1) }));
  return result.challenges.slice(0, batchSize);
}

/** Returns the insert row, or null when the starter code already prints the answer (student would get a free pass). */
async function verifyCodeChallenge(c: CodeChallenge): Promise<Omit<ChallengeInsert, "track" | "scope_key"> | null> {
  if (!isSupportedLanguage(c.language)) return null;
  try {
    const result = await runCode(c.language, c.starter_code, c.stdin);
    if (result.stdout.trim() === c.expected_output.trim()) return null;
  } catch {
    return null;
  }
  return {
    kind: "code",
    title: c.title,
    category: c.category,
    difficulty: c.difficulty,
    scenario: c.scenario,
    objective: c.objective,
    language: c.language,
    starter_code: c.starter_code,
    stdin: c.stdin,
    expected_output: c.expected_output,
    skill_tags: c.skill_tags,
  };
}

async function runForNumber(pythonSource: string): Promise<number | null> {
  try {
    const stdout = (await runCode("python", pythonSource, "")).stdout.trim();
    const value = Number(stdout);
    return stdout !== "" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

const IndependentSolutionSchema = z.object({ solution: z.string().min(1) });

/**
 * The official answer is the printed output of the hidden reference
 * solution -- but that solution can use a wrong formula. So a second,
 * independent model call solves the problem from the student-visible text
 * alone; the challenge is kept only if both agree within tolerance.
 */
async function verifyNumericChallenge(c: NumericChallenge): Promise<Omit<ChallengeInsert, "track" | "scope_key"> | null> {
  const value = await runForNumber(c.reference_solution);
  if (value === null) return null;

  let independent: number | null;
  try {
    const { solution } = await completeJson(
      `Problem:\n${c.scenario}\n\nTask: ${c.objective}\nAnswer unit: ${c.answer_unit}`,
      `You are a careful engineering examiner. Solve the problem using the standard textbook method, using ONLY the values stated. If any value needed to solve it is missing and would have to be assumed, the program must print exactly UNDERSPECIFIED instead of a number. Respond with JSON only: {"solution": "a standalone Python 3 program (standard library only) that computes the answer and prints ONLY the final number in the requested unit"}. No markdown, no code fences.`,
      IndependentSolutionSchema
    );
    independent = await runForNumber(solution);
  } catch {
    return null;
  }
  if (independent === null || !isNumericAnswerCorrect(String(independent), String(value))) return null;
  return {
    kind: "numeric",
    title: c.title,
    category: c.category,
    difficulty: c.difficulty,
    scenario: c.scenario,
    objective: c.objective,
    language: "python",
    starter_code: null,
    stdin: null,
    expected_output: String(value),
    answer_unit: c.answer_unit,
    skill_tags: c.skill_tags,
  };
}

/**
 * Tops up the stream pool for one scope until it has MIN_POOL_SIZE live or
 * pending-review challenges. AI output is stored as DRAFT and is never served
 * to students until a Capabilio admin publishes it (the database enforces this). The IT cluster gets coding challenges; every other branch
 * gets numeric calculation challenges in its own subject.
 */
export async function ensureChallengePool(serviceClient: SupabaseClient<Database>, scopeKey: string, promptLabel: string): Promise<{ inserted: number }> {
  const { count } = await serviceClient.from("arena_challenges").select("id", { count: "exact", head: true }).eq("track", "stream").eq("scope_key", scopeKey).or("active.eq.true,status.eq.DRAFT");

  const existing = count ?? 0;
  if (existing >= MIN_POOL_SIZE) return { inserted: 0 };

  const { data: existingTitles } = await serviceClient.from("arena_challenges").select("title").eq("track", "stream").eq("scope_key", scopeKey);
  const avoidTitles = (existingTitles ?? []).map((t) => t.title);

  const isCode = scopeKey === IT_CLUSTER_SCOPE_KEY;
  const target = MIN_POOL_SIZE - existing;
  const accepted: Omit<ChallengeInsert, "track" | "scope_key">[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS && accepted.length < target; attempt++) {
    const batchSize = Math.min(BATCH_SIZE, target - accepted.length);
    const avoid = [...avoidTitles, ...accepted.map((c) => c.title)];
    const verified = isCode
      ? await Promise.all((await generateBatch(CodeChallengeSchema, codeSystemPrompt(promptLabel), batchSize, avoid)).map(verifyCodeChallenge))
      : await Promise.all((await generateBatch(NumericChallengeSchema, numericSystemPrompt(promptLabel), batchSize, avoid)).map(verifyNumericChallenge));

    for (const row of verified) {
      if (row) accepted.push(row);
      else console.warn(`[arena-challenges/generate] discarded a ${isCode ? "code" : "numeric"} challenge for ${scopeKey} that failed verification`);
    }
  }

  const rows = accepted.slice(0, target).map((row) => ({ ...row, track: "stream", scope_key: scopeKey, active: false, status: "DRAFT", source: "AI_GENERATED" }));
  if (rows.length === 0) return { inserted: 0 };

  // untyped: lib/supabase/types.ts predates migration 061's status/source columns
  const { error } = await untyped(serviceClient).from("arena_challenges").insert(rows);
  if (error) throw error;
  return { inserted: rows.length };
}
