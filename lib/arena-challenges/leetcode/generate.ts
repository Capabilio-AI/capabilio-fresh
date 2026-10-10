// AI writes the problem; code decides whether it is trustworthy. Test OUTPUTS are never taken from the model: they are produced by
// running the reference solution, and a second independent model solution (written from the student-visible text alone) must
// reproduce every one of them. A problem that fails any step is discarded.
import { z } from "zod";
import { generateStructured, type GenerateDeps } from "@/lib/ai/llm";
import { GeneratedBatchSchema, GeneratedProblemSchema, type GeneratedProblem, type PublicProblem } from "./problem";
import { outputsMatch, wandboxExecutor, type Executor, type JudgeTest } from "./judge";

export const PROMPT_VERSION = "leetcode.v1";
const MAX_OUTPUT_CHARS = 600;

const DIFFICULTY_GUIDE = {
  easy: "a first-year student who knows loops, conditions, lists and strings can solve it in 10 minutes (counting, simple scans, basic string or array handling)",
  medium: "a second-year student who knows hashing, sorting and two pointers can solve it in 20 minutes; one clear idea beyond brute force",
  hard: "a strong second/third-year student needs 30 minutes: a known technique such as dynamic programming, binary search on the answer or BFS on a small grid; brute force must clearly be too slow for the constraints",
} as const;

const SHAPE = `{
  "problems": [{
    "title": "string",
    "category": "string (e.g. Arrays, Strings, Hashing, Two Pointers, Sorting, Stack, Recursion, Math, Matrix, Greedy, Binary Search, Dynamic Programming)",
    "difficulty": "easy | medium | hard (exactly the DIFFICULTY given)",
    "statement": "the full problem in plain text, LeetCode style: a short story or direct task, no hints about the solution",
    "input_format": "exactly how stdin is laid out, line by line",
    "output_format": "exactly what to print",
    "constraints": ["e.g. 1 <= n <= 1000"],
    "sample_inputs": ["2 complete stdin inputs, small enough to follow by hand"],
    "sample_explanations": ["2 short explanations, one per sample input, of why the output is what it is (do NOT write the output itself)"],
    "hidden_inputs": ["4 to 6 complete stdin inputs: edge cases (minimum size, duplicates, negatives if allowed, all-equal) and one larger case within constraints"],
    "reference_solution": "a correct, efficient Python 3 program that reads ALL input from stdin and prints ONLY the answer",
    "starter_python": "Python skeleton: reads the input exactly as input_format says and has a single TODO where the logic goes. It must NOT contain the solution logic and must print nothing useful.",
    "starter_c": "the same skeleton in C (stdio.h), reading the input and leaving the logic as a TODO",
    "skill_tags": ["string"]
  }]
}`;

export interface GenerateContext {
  difficulty: "easy" | "medium" | "hard";
  count: number;
  /** topics to lean on this week, so the nine problems differ */
  topics: string[];
  avoidTitles: string[];
}

export function buildPrompt(c: GenerateContext) {
  const system = `You write coding problems for a LeetCode-style practice arena used by Indian B.Tech CSE/IT/AI students.
Rules:
- Every problem reads from standard input and writes to standard output (no function signatures). Input and output must be exactly specified and deterministic: one correct output per input, no "any valid answer", no floating point unless the output is rounded to a stated number of digits.
- Self-contained: no files, no randomness, no network, standard library only.
- Original wording; do not copy a well-known problem verbatim. No hints in the statement.
- Inputs must satisfy the stated constraints exactly and stay small enough to run in a second in Python.
Respond with ONE JSON object, no prose, no code fences, matching exactly:
${SHAPE}`;
  const user = [
    `DIFFICULTY: ${c.difficulty} (${DIFFICULTY_GUIDE[c.difficulty]})`,
    `Lean on these topics, one per problem where possible: ${c.topics.join(", ")}`,
    c.avoidTitles.length ? `Do not reuse these titles or ideas:\n- ${c.avoidTitles.join("\n- ")}` : "",
    `Write ${c.count} different problems.`,
  ].filter(Boolean).join("\n");
  return { system, user };
}

const SolutionSchema = z.object({ solution: z.string().min(5) });

async function solveIndependently(p: GeneratedProblem, deps: GenerateDeps): Promise<string | null> {
  try {
    const out = await generateStructured(
      {
        task: "challenge_verify",
        system: `You are a careful competitive programmer. Solve the problem exactly as stated. Respond with ONE JSON object {"solution": "a complete Python 3 program that reads all of stdin and prints only the answer"} and nothing else.`,
        user: `${p.statement}\n\nInput format:\n${p.input_format}\n\nOutput format:\n${p.output_format}\n\nConstraints:\n${p.constraints.join("\n")}\n\nExample input:\n${p.sample_inputs[0]}`,
        schema: SolutionSchema,
        temperature: 0,
        maxTokens: 1500,
        promptVersion: "leetcode-verify.v1",
      },
      deps
    );
    return out.value.solution;
  } catch {
    return null;
  }
}

export interface VerifiedProblem {
  problem: GeneratedProblem;
  tests: JudgeTest[];
  sampleCount: number;
  publicProblem: PublicProblem;
}

/** Null when the problem cannot be trusted. `run` is injectable so the whole check is testable without the network. */
export async function verifyProblem(p: GeneratedProblem, deps: GenerateDeps = {}, exec: Executor = wandboxExecutor): Promise<{ ok: true; value: VerifiedProblem } | { ok: false; reason: string }> {
  const inputs = [...p.sample_inputs, ...p.hidden_inputs].map((s) => s.replace(/\r/g, "").trimEnd() + "\n");
  if (new Set(inputs).size !== inputs.length) return { ok: false, reason: "duplicate test inputs" };

  const reference = await exec("python", p.reference_solution, inputs).catch(() => null);
  if (!reference) return { ok: false, reason: "code runner unavailable" };
  const outputs = reference.map((r) => (r.compileError || (r.stderr.trim() !== "" && r.stdout.trim() === "") ? null : r.stdout.trim()));
  if (outputs.some((o) => o === null || o === "" || o.length > MAX_OUTPUT_CHARS)) return { ok: false, reason: "reference solution failed or printed nothing usable" };
  const clean = outputs as string[];
  if (new Set(clean).size < 2) return { ok: false, reason: "every test has the same answer" };

  const independent = await solveIndependently(p, deps);
  if (!independent) return { ok: false, reason: "no independent solution" };
  const second = await exec("python", independent, inputs).catch(() => null);
  if (!second || second.some((r, i) => !outputsMatch(r.stdout, clean[i]))) return { ok: false, reason: "independent solution disagrees with the reference" };

  // the starter must not already solve it
  const starter = await exec("python", p.starter_python, [inputs[0]]).catch(() => null);
  if (starter && outputsMatch(starter[0].stdout, clean[0])) return { ok: false, reason: "starter code already prints the answer" };

  const tests = inputs.map((input, i) => ({ input, output: clean[i] }));
  return {
    ok: true,
    value: {
      problem: p,
      tests,
      sampleCount: p.sample_inputs.length,
      publicProblem: {
        statement: p.statement,
        inputFormat: p.input_format,
        outputFormat: p.output_format,
        constraints: p.constraints,
        examples: p.sample_inputs.map((input, i) => ({ input: inputs[i].trimEnd(), output: clean[i], explanation: p.sample_explanations[i] })),
        starters: { python: p.starter_python, c: p.starter_c },
      },
    },
  };
}

export interface BatchOutcome {
  verified: VerifiedProblem[];
  rejected: string[];
}

/** One model call, then every problem in it is checked independently. Problems of the wrong difficulty are rejected. */
export async function generateAndVerify(ctx: GenerateContext, deps: GenerateDeps = {}, exec: Executor = wandboxExecutor): Promise<BatchOutcome> {
  const { system, user } = buildPrompt(ctx);
  const gen = await generateStructured({ task: "challenge", system, user, schema: GeneratedBatchSchema, maxTokens: 6000, temperature: 0.7, promptVersion: PROMPT_VERSION }, deps);
  const rejected: string[] = [];
  const parsed: GeneratedProblem[] = [];
  const titles = new Set(ctx.avoidTitles.map((t) => t.toLowerCase()));
  for (const raw of gen.value.problems.slice(0, ctx.count)) {
    const r = GeneratedProblemSchema.safeParse(raw);
    if (!r.success) { rejected.push(`schema: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`); continue; }
    if (r.data.difficulty !== ctx.difficulty) { rejected.push(`difficulty ${r.data.difficulty} != ${ctx.difficulty}`); continue; }
    if (titles.has(r.data.title.toLowerCase())) { rejected.push("duplicate title"); continue; }
    titles.add(r.data.title.toLowerCase());
    parsed.push(r.data);
  }
  const verified: VerifiedProblem[] = [];
  for (const p of parsed) { // one at a time: each check already runs several code executions in parallel
    const v = await verifyProblem(p, deps, exec);
    if (v.ok) verified.push(v.value); else rejected.push(`${p.title}: ${v.reason}`);
  }
  return { verified, rejected };
}
