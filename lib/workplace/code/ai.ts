import { z } from "zod";
import { completeJsonDetailed } from "@/lib/ai/groq";
import { GenerationRejected, DIFFICULTY_LABEL, type GenerationContext } from "@/lib/arena-workstations/types";
import { makeRng } from "../rng";
import { same } from "./compare";
import { EXAMPLE_COUNT, MAX_SUBMISSIONS, type CodeDraft } from "./problems";
import { runInSandbox, type CaseResult } from "./sandbox";

const FN = /^[a-z][a-z0-9_]{2,40}$/;
const MAX_CASES_BYTES = 40_000;

const GenSchema = z.object({
  title: z.string().min(8).max(90),
  requester_name: z.string().min(2).max(40),
  requester_title: z.string().min(2).max(60),
  scenario: z.string().min(40).max(900),
  deliverable: z.string().min(30).max(2000),
  function_name: z.string().regex(FN),
  params: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,30}$/)).min(1).max(4),
  skill_tags: z.array(z.string().min(1).max(30)).min(1).max(5),
  cases: z.array(z.array(z.unknown())).min(8).max(16),
  solution_js: z.string().min(20).max(4000),
  wrong_js: z.string().min(20).max(4000),
  broken_javascript: z.string().max(4000).optional(),
  broken_python: z.string().max(4000).optional(),
});
type Gen = z.infer<typeof GenSchema>;
const SolverSchema = z.object({ solution_js: z.string().min(20).max(4000) });

export interface Deps {
  llm<T>(prompt: string, system: string, schema: z.ZodType<T>): Promise<T>;
  run(source: string, fn: string, cases: unknown[][]): Promise<CaseResult[]>;
}
// a backend exercise carries long statements, objects and several code samples, so it needs more room than the default
export const realDeps: Deps = { llm: async (p, s, schema) => (await completeJsonDetailed(p, s, schema, { task: "arena_task", maxTokens: 12000 })).value, run: runInSandbox };

const DEBUG_AREAS = ["debugging", "backend-debugging"];
const isDebug = (area: string) => DEBUG_AREAS.includes(area);
const THEMES = ["a food delivery app", "a hospital appointment desk", "a school timetable", "a ride-sharing service", "a small bank", "an online library", "a cricket league", "a warehouse", "a movie ticket counter", "a railway reservation system", "a mobile recharge shop", "a weather station", "a payroll team", "a photo-sharing app", "a hotel front desk"];
const TECHNIQUES: Record<string, string[]> = {
  fundamentals: ["string cleaning or formatting", "arithmetic with business rules", "filtering and counting in a list", "working with text and counts", "date-free calendar or clock arithmetic with whole numbers", "conditionals with several rules"],
  "data-structures": ["a stack", "a queue or sliding window", "a hash map or counting", "sorting with a custom order", "intervals or ranges", "two pointers on a sorted list"],
  algorithms: ["dynamic programming", "breadth-first search on a grid or graph", "binary search on an answer", "greedy choice", "prefix sums", "recursion with memoisation"],
  "rest-api": ["routing a method and path to a handler with 404 and 405 answers", "validating a JSON body and answering 422 with a message", "create, read, update and delete on an in-memory collection with ids from 1", "filtering and sorting a list endpoint by query values", "choosing between 200, 201, 204, 400, 404 and 409", "a PATCH that changes only the fields sent"],
  "auth-and-security": ["checking a bearer token against a table with expiry (timestamps passed in)", "role-based access: 401 for no or bad credentials, 403 for not allowed", "a fixed-window or sliding-window rate limiter over a list of request times", "ownership checks so a user cannot read another user's record", "input sanitising rules that reject unsafe values", "API key scopes that allow some methods and paths and not others"],
  "data-and-state": ["idempotency keys so a retried request does not create a second record", "cursor or page-based pagination with total pages and a next flag", "a cache with a time-to-live (times passed in) that counts hits and misses", "optimistic concurrency with version numbers and a 409 on a stale write", "a simple transaction that applies all steps or none", "counting and aggregating events into per-key totals"],
  "error-handling": ["retry with exponential backoff and a maximum number of attempts, simulating the outcomes", "a circuit breaker that opens after N failures and closes after a cool-down (times passed in)", "mapping internal error kinds to HTTP status codes and messages", "a dead-letter rule: after N failed attempts a message moves aside", "timeouts and fallbacks: use a default when a dependency fails", "collecting validation errors for every field rather than stopping at the first"],
  "backend-debugging": ["a handler that answers the wrong status code for one case", "pagination with an off-by-one in the page index or total pages", "a handler that forgets to check that a record exists before updating it", "state that leaks between requests because an object is shared and mutated", "a comparison of strings and numbers that never matches", "a rate limiter that resets at the wrong moment"],
  debugging: ["an off-by-one error", "a wrong edge case (empty input or ties)", "a loop that forgets the last item", "using the wrong comparison", "mutating a list while reading it", "integer division or rounding mistakes"],
};

const SYSTEM = `You write one programming exercise for a learner, as a task from a colleague at a fictional Indian company. You also write the code that proves the exercise is fair.

Rules:
- The learner writes ONE function and may use Python or JavaScript, so the exercise must be language-neutral.
- Inputs and outputs are JSON only. Outputs must be integers, strings, booleans, null, or (nested) lists and objects (string keys) of those. NEVER return decimals or sets: use whole numbers (paise, minutes, counts) instead; use a list when order matters. State rounding and ordering rules (including tie-breaks) exactly, so there is one correct answer.
- "cases": between 8 and 16 argument lists, each a JSON array holding one value per parameter. The first two must be simple and illustrate the task; the rest must cover edge cases (empty input, single item, ties, duplicates, negatives where relevant) and typical inputs. Keep inputs small (at most 8 requests or items per case) so the whole answer stays short.
- "solution_js": a correct JavaScript implementation named exactly function_name. "wrong_js": a plausible but WRONG implementation (the mistake most learners would make), also named function_name, that gives a different result on at least one case.
- No comments describing the solution inside the scenario or deliverable. The deliverable must define the behaviour completely.
- Output JSON only, exactly the requested shape.`;

const BACKEND = `This is a BACKEND exercise: model an API or server behaviour as ONE pure function that receives the whole scenario as input and returns what the server would answer. The usual shape is handle_requests(requests) where each request is an object such as {"method": "POST", "path": "/orders", "headers": {...}, "body": {...}} and the function returns a list with one response object per request, each {"status": 201, "body": {...}}, handling the requests in order with any state (records, ids starting at 1, counters) kept inside the function. A response body must be a copy of the record at that moment, not a reference that later requests change. State the routes, validation rules, exact status codes, exact response bodies and id rules in the deliverable, so there is one correct answer. No real time, randomness, networking or databases: pass timestamps in as whole numbers.`;

const SOLVER_SYSTEM = `You are given a programming task. Write a correct JavaScript function with the requested name. Read the task literally, follow every rule it states, and return only JSON: {"solution_js": "<the function source>"}.`;

function describe(ctx: GenerationContext): string {
  const rng = makeRng(ctx.ticketSeed ?? 1);
  const area = ctx.areaKey ?? "fundamentals";
  const technique = rng.pick(TECHNIQUES[area] ?? TECHNIQUES.fundamentals);
  const theme = rng.pick(THEMES);
  const debug = isDebug(area);
  const backend = ctx.roleKey === "backend-developer";
  return `Area: ${ctx.areaName}. Difficulty: ${DIFFICULTY_LABEL[ctx.difficulty]}. Experience of the learner: ${ctx.level ?? "fresher"}.
Setting: ${theme}. Core idea to exercise: ${technique}.
${backend ? BACKEND : ""}
${debug ? 'This is a DEBUGGING exercise: also return "broken_javascript" and "broken_python", the same function with ONE realistic bug, so that it passes some cases and fails others. The deliverable asks the learner to fix it.' : 'Do not include broken_javascript or broken_python.'}
${ctx.avoidTitles.length ? `Do not reuse or rephrase these earlier titles, and pick a different problem altogether:\n- ${ctx.avoidTitles.slice(0, 20).join("\n- ")}` : ""}`;
}

const isPlain = (v: unknown): boolean =>
  v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isSafeInteger(v)) || (Array.isArray(v) && v.every(isPlain)) || (typeof v === "object" && !Array.isArray(v) && Object.values(v as object).every(isPlain));
const key = (v: unknown) => JSON.stringify(v);

function allOk(results: CaseResult[], what: string): unknown[] {
  const bad = results.findIndex((r) => !r.ok || !isPlain(r.value));
  if (bad >= 0) throw new GenerationRejected(`${what} failed or returned a non-integer / non-JSON value on case ${bad + 1}${results[bad].error ? `: ${results[bad].error}` : ""}`);
  return results.map((r) => r.value);
}

/** Pure checks on the generated exercise plus the runs of its code. Throws GenerationRejected with the first problem. */
export async function validate(raw: Gen, area: string, avoid: readonly string[], second: string, deps: Deps): Promise<unknown[]> {
  if (avoid.some((t) => t.trim().toLowerCase() === raw.title.trim().toLowerCase())) throw new GenerationRejected("title repeats an earlier ticket");
  if (raw.cases.some((c) => c.length !== raw.params.length)) throw new GenerationRejected("every case needs exactly one value per parameter");
  if (!raw.cases.every(isPlainArgs)) throw new GenerationRejected("cases may only hold integers, strings, booleans, null, lists and objects of those");
  if (new Set(raw.cases.map(key)).size < raw.cases.length - 1) throw new GenerationRejected("cases repeat");
  if (key(raw.cases).length > MAX_CASES_BYTES) throw new GenerationRejected("cases are too large");

  const expected = allOk(await deps.run(raw.solution_js, raw.function_name, raw.cases), "the solution");
  if (new Set(expected.map(key)).size < 3) throw new GenerationRejected("the answers barely vary, so a constant answer would pass");

  const wrong = await deps.run(raw.wrong_js, raw.function_name, raw.cases).catch(() => null);
  if (wrong && wrong.every((r, i) => r.ok && same(r.value, expected[i]))) throw new GenerationRejected("the wrong solution is not wrong on any case");

  const independent = allOk(await deps.run(second, raw.function_name, raw.cases), "the independent solution");
  const differ = independent.findIndex((v, i) => !same(v, expected[i]));
  if (differ >= 0) throw new GenerationRejected(`two independent solutions disagree on case ${differ + 1}, so the statement is ambiguous or wrong`);

  if (isDebug(area)) {
    if (!raw.broken_javascript || !raw.broken_python?.includes(`def ${raw.function_name}(`) || !raw.broken_javascript.includes(raw.function_name)) throw new GenerationRejected("a debugging exercise needs broken code in both languages");
    const broken = await deps.run(raw.broken_javascript, raw.function_name, raw.cases).catch(() => null);
    const passes = broken ? broken.map((r, i) => r.ok && same(r.value, expected[i])) : [];
    if (!passes.some((p) => !p) || !passes.some(Boolean)) throw new GenerationRejected("the broken code must pass some cases and fail others");
  }
  return expected;
}
const isPlainArgs = (c: unknown[]) => c.every(isPlain);

const starterFor = (fn: string, params: string[]) => ({
  python: `def ${fn}(${params.join(", ")}):\n    # write your solution here\n    pass\n`,
  javascript: `function ${fn}(${params.join(", ")}) {\n  // write your solution here\n}\n`,
});

/** One fresh exercise for this user's skill area and level, accepted only if its own code proves it fair. */
export async function generateAiProblem(ctx: GenerationContext, deps: Deps = realDeps, previousProblem?: string): Promise<CodeDraft> {
  const area = ctx.areaKey ?? "fundamentals";
  const retry = previousProblem ? `\nYour previous attempt was rejected because: ${previousProblem}. Fix that: every case must have exactly one value per parameter, the wrong solution must differ from the correct one on at least one of your cases, the statement must leave no ambiguity, and keep every case small.` : "";
  const raw = await deps.llm(`Create the exercise.\n${describe(ctx)}${retry}`, SYSTEM, GenSchema);
  // an independent solver sees only the statement, never the first solution
  const statement = `Title: ${raw.title}\nScenario: ${raw.scenario}\nTask: ${raw.deliverable}\nFunction: ${raw.function_name}(${raw.params.join(", ")})\nExample inputs: ${key(raw.cases.slice(0, EXAMPLE_COUNT))}`;
  const second = (await deps.llm(statement, SOLVER_SYSTEM, SolverSchema)).solution_js;
  const expected = await validate(raw, area, ctx.avoidTitles, second, deps);

  return {
    title: raw.title,
    requester: { name: raw.requester_name, title: raw.requester_title },
    scenario: raw.scenario,
    skillTags: raw.skill_tags,
    content: {
      fn: raw.function_name, params: raw.params, cases: raw.cases,
      examples: raw.cases.slice(0, EXAMPLE_COUNT).map((args, i) => ({ args, expected: expected[i] })),
      starters: isDebug(area) ? { python: raw.broken_python!, javascript: raw.broken_javascript! } : starterFor(raw.function_name, raw.params),
      deliverable: raw.deliverable, maxSubmissions: MAX_SUBMISSIONS, timeLimitSeconds: 20,
    },
    key: { expected },
  };
}
