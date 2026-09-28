import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { completeJson } from "@/lib/ai/groq";

// Coding-only in v1, deliberately: this keeps evaluation to the same
// exact-output-match already used by the assessment engine's coding
// questions (app/api/assessment/[section]/coding-submit) via the same
// runCode() -- no new evaluator, and no AI ever decides whether a
// submission is correct. Matches lib/code-execution/wandbox.ts's real
// supported languages, not an arbitrary choice.
const SUPPORTED_LANGUAGES = ["python", "c"] as const;

const BATCH_SIZE = 4;
const MIN_POOL_SIZE = 6;

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

function streamSystemPrompt(branch: string): string {
  return `You write short, real, solvable coding challenges for a "${branch}" engineering/science student on a
career-readiness platform's Arena. These are Stream challenges: practical, branch-relevant problems a
${branch} student should be able to reason through with basic programming (Python or C), not abstract
computer-science trivia unrelated to their field.

Ground each challenge in something a ${branch} student would actually compute or simulate in their coursework
or early career (e.g. a numeric calculation, a simple data-processing task, a basic simulation relevant to
${branch}) -- not a generic LeetCode-style array/string puzzle unless ${branch} genuinely is a CS-adjacent field.

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
      "starter_code": "string -- a short starting skeleton matching the language field above",
      "stdin": "string -- sample input the program reads via stdin, or empty string if none",
      "expected_output": "string -- the EXACT stdout the correct solution must print for the given stdin, nothing else, no trailing explanation",
      "skill_tags": ["string", "..."]
    }
  ]
}

Critical: expected_output must be the literal, exact text a correct program prints for that exact stdin --
this is checked with a plain string comparison, not fuzzy matching. No markdown, no code fences, valid JSON only.`;
}

function domainSystemPrompt(careerRole: string): string {
  return `You write short, real, solvable coding challenges for a student practicing for a "${careerRole}" career
on a career-readiness platform's Arena. These are Domain challenges: a task genuinely relevant to what a
${careerRole} does day to day, solved with a short Python or C program -- e.g. for a Data Analyst, computing a
statistic from sample data; for a Software Engineer, implementing a small real function; for a Business
Analyst or Product Designer, a script that processes or summarizes structured input the way that role
actually would. Never abstract trivia disconnected from the role.

Respond with JSON only, matching this exact shape:
{
  "challenges": [
    {
      "title": "string",
      "category": "string (a short tag like 'Data Analysis', 'API Logic', 'Metrics Calculation')",
      "difficulty": "easy" | "medium" | "hard",
      "scenario": "string -- 2-4 sentences setting up a realistic ${careerRole} task",
      "objective": "string -- exactly what the program must do",
      "language": "python" | "c",
      "starter_code": "string -- a short starting skeleton matching the language field above",
      "stdin": "string -- sample input the program reads via stdin, or empty string if none",
      "expected_output": "string -- the EXACT stdout the correct solution must print for the given stdin, nothing else",
      "skill_tags": ["string", "..."]
    }
  ]
}

Critical: expected_output must be the literal, exact text a correct program prints for that exact stdin --
checked with a plain string comparison, not fuzzy matching. No markdown, no code fences, valid JSON only.`;
}

async function generateBatch(systemPrompt: string, batchSize: number, avoidTitles: string[]) {
  const avoid = avoidTitles.length > 0 ? `\n\nDo not repeat or closely rephrase any of these already-used titles:\n- ${avoidTitles.join("\n- ")}` : "";
  const result = await completeJson(`Generate ${batchSize} challenges.${avoid}`, systemPrompt, BatchSchema);
  return result.challenges.slice(0, batchSize);
}

export type ChallengeTrack = "stream" | "domain";

/**
 * Tops up the arena_challenges catalog for one (track, scope) until it has
 * at least MIN_POOL_SIZE active challenges -- callable repeatedly (e.g.
 * from the challenges API route when a scope's pool is thin) without
 * regenerating what already exists, same top-up shape as
 * generateQuestionBankForSection.
 */
export async function ensureChallengePool(
  serviceClient: SupabaseClient<Database>,
  track: ChallengeTrack,
  scopeKey: string
): Promise<{ inserted: number }> {
  const { count } = await serviceClient
    .from("arena_challenges")
    .select("id", { count: "exact", head: true })
    .eq("track", track)
    .eq("scope_key", scopeKey)
    .eq("active", true);

  const existing = count ?? 0;
  if (existing >= MIN_POOL_SIZE) return { inserted: 0 };

  const { data: existingTitles } = await serviceClient
    .from("arena_challenges")
    .select("title")
    .eq("track", track)
    .eq("scope_key", scopeKey);

  const systemPrompt = track === "stream" ? streamSystemPrompt(scopeKey) : domainSystemPrompt(scopeKey);
  const target = MIN_POOL_SIZE - existing;
  const generated: z.infer<typeof GeneratedChallengeSchema>[] = [];
  const avoidTitles = (existingTitles ?? []).map((t) => t.title);

  while (generated.length < target) {
    const batchSize = Math.min(BATCH_SIZE, target - generated.length);
    const batch = await generateBatch(systemPrompt, batchSize, [...avoidTitles, ...generated.map((c) => c.title)]);
    generated.push(...batch);
  }

  const rows = generated.slice(0, target).map((c) => ({
    track,
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

  const { error } = await serviceClient.from("arena_challenges").insert(rows);
  if (error) throw error;

  return { inserted: rows.length };
}
