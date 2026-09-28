import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { completeJson } from "@/lib/ai/groq";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";

// Coding-only, deliberately: this keeps evaluation to the same
// exact-output-match already used by the assessment engine's coding
// questions (app/api/assessment/[section]/coding-submit) via the same
// runCode() -- no new evaluator, and no AI ever decides whether a
// submission is correct. Matches lib/code-execution/wandbox.ts's real
// supported languages, not an arbitrary choice.
const SUPPORTED_LANGUAGES = ["python", "c"] as const;

const BATCH_SIZE = 4;
const MIN_POOL_SIZE = 14;

const GeneratedChallengeSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  scenario: z.string().min(1),
  objective: z.string().min(1),
  language: z.enum(SUPPORTED_LANGUAGES),
  starter_code: z.string().min(1),
  stdin: z.string().default(""),
  expected_output: z.string().min(1),
  skill_tags: z.array(z.string().min(1)).min(1).max(5),
});
const BatchSchema = z.object({ challenges: z.array(GeneratedChallengeSchema).min(1) });

function streamSystemPrompt(promptLabel: string): string {
  return `You write short, real, solvable coding challenges for a "${promptLabel}" engineering/science student on a
career-readiness platform's Arena. These are Stream challenges: practical, branch-relevant, curriculum-adjacent
problems a ${promptLabel} student should be able to reason through with basic programming (Python or C), not
abstract computer-science trivia unrelated to their field.

Ground each challenge in something a ${promptLabel} student would actually compute or simulate in their coursework
or early career (e.g. a numeric calculation, a simple data-processing task, a basic simulation relevant to
${promptLabel}) -- not a generic LeetCode-style array/string puzzle unless ${promptLabel} genuinely is a CS-adjacent field.

Respond with JSON only, matching this exact shape:
{
  "challenges": [
    {
      "title": "string",
      "category": "string (a short tag like 'Numerical Methods', 'Data Processing', 'Simulation')",
      "difficulty": "easy" | "medium" | "hard",
      "scenario": "string -- 2-4 sentences setting up a realistic problem",
      "objective": "string -- exactly what the program must do",
      "language": "python" | "c",
      "starter_code": "string -- ONLY a bare skeleton: imports, the function/main signature, reading stdin if needed, and a single placeholder line (e.g. 'pass', 'return None', or a TODO comment) where the real logic goes. It must NOT contain any part of the actual algorithm, calculation, or logic that solves the problem -- a student who only ran starter_code unmodified must get wrong or empty output, never the expected_output.",
      "stdin": "string -- sample input the program reads via stdin, or empty string if none",
      "expected_output": "string -- the EXACT stdout the correct solution must print for the given stdin, nothing else, no trailing explanation",
      "skill_tags": ["string", "..."]
    }
  ]
}

Critical: expected_output must be the literal, exact text a correct program prints for that exact stdin --
this is checked with a plain string comparison, not fuzzy matching. starter_code must never already produce
expected_output when run as-is -- it is verified by actually running it before being shown to a student, and
any challenge whose starter_code already solves the problem is discarded and regenerated. No markdown, no code
fences, valid JSON only.`;
}

async function generateBatch(systemPrompt: string, batchSize: number, avoidTitles: string[]) {
  const avoid = avoidTitles.length > 0 ? `\n\nDo not repeat or closely rephrase any of these already-used titles:\n- ${avoidTitles.join("\n- ")}` : "";
  const result = await completeJson(`Generate ${batchSize} challenges.${avoid}`, systemPrompt, BatchSchema);
  return result.challenges.slice(0, batchSize);
}

/**
 * A generated challenge is only usable if its own starter_code, run
 * unmodified, does NOT already print expected_output -- otherwise a
 * student gets a free pass without writing anything, which defeats the
 * entire point of the challenge. Checked by actually running it through
 * the same runCode() a real submission uses, not inferred from the
 * prompt's instructions alone.
 */
async function starterCodeLeaksSolution(challenge: z.infer<typeof GeneratedChallengeSchema>): Promise<boolean> {
  if (!isSupportedLanguage(challenge.language)) return true; // unusable either way -- treat as unsafe, discard
  try {
    const result = await runCode(challenge.language, challenge.starter_code, challenge.stdin);
    return result.stdout.trim() === challenge.expected_output.trim();
  } catch {
    // Execution failure isn't evidence the starter code leaks the answer,
    // but it does mean this challenge can't be verified safe -- discard
    // rather than risk it.
    return true;
  }
}

export type ChallengeTrack = "stream";

/**
 * Tops up the arena_challenges catalog for one scope until it has at
 * least MIN_POOL_SIZE active challenges -- callable repeatedly (e.g. from
 * the challenges API route when a scope's pool is thin) without
 * regenerating what already exists, same top-up shape as
 * generateQuestionBankForSection.
 *
 * `scopeKey` is the storage/lookup key (e.g. "it-cluster" or
 * "branch-mba") -- `promptLabel` is what actually goes in front of the
 * model (e.g. "Computer Science / IT / AI-ML" or "MBA"), since a cluster
 * key isn't a real subject to write challenges about.
 */
export async function ensureChallengePool(serviceClient: SupabaseClient<Database>, scopeKey: string, promptLabel: string): Promise<{ inserted: number }> {
  const { count } = await serviceClient.from("arena_challenges").select("id", { count: "exact", head: true }).eq("track", "stream").eq("scope_key", scopeKey).eq("active", true);

  const existing = count ?? 0;
  if (existing >= MIN_POOL_SIZE) return { inserted: 0 };

  const { data: existingTitles } = await serviceClient.from("arena_challenges").select("title").eq("track", "stream").eq("scope_key", scopeKey);

  const systemPrompt = streamSystemPrompt(promptLabel);
  const target = MIN_POOL_SIZE - existing;
  const accepted: z.infer<typeof GeneratedChallengeSchema>[] = [];
  const avoidTitles = (existingTitles ?? []).map((t) => t.title);

  // Bounded: a generator that keeps producing solution-leaking starter
  // code should eventually give up rather than loop forever.
  let attempts = 0;
  const MAX_ATTEMPTS = 10;
  while (accepted.length < target && attempts < MAX_ATTEMPTS) {
    attempts++;
    const batchSize = Math.min(BATCH_SIZE, target - accepted.length);
    const batch = await generateBatch(systemPrompt, batchSize, [...avoidTitles, ...accepted.map((c) => c.title)]);
    for (const challenge of batch) {
      if (await starterCodeLeaksSolution(challenge)) {
        console.warn(`[arena-challenges/generate] discarded "${challenge.title}" -- starter_code already produced expected_output`);
        continue;
      }
      accepted.push(challenge);
    }
  }

  const rows = accepted.slice(0, target).map((c) => ({
    track: "stream",
    scope_key: scopeKey,
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
    active: true,
  }));

  if (rows.length === 0) return { inserted: 0 };

  const { error } = await serviceClient.from("arena_challenges").insert(rows);
  if (error) throw error;

  return { inserted: rows.length };
}
