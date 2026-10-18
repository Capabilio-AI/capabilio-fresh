// Per-student Stream challenges for any branch. The AI writes the problem; it is served only if its own code proves it fair:
//  - numeric: a hidden JavaScript solution is run for the official answer, an independent solver (statement only) must reach the same number,
//    and the answer must not already sit in the statement;
//  - mcq (concept / case): an independent solver sees the shuffled options and must pick the same one.
// The official answer is never the model's own arithmetic or its own say-so.
import { z } from "zod";
import { completeJsonDetailed } from "@/lib/ai/groq";
import { GenerationRejected } from "@/lib/arena-workstations/types";
import { makeRng } from "@/lib/workplace/rng";
import { runInSandbox, type CaseResult } from "@/lib/workplace/code/sandbox";

export type Difficulty = "easy" | "medium" | "hard";
export type StreamKind = "numeric" | "mcq";
export const OPTION_KEYS = ["A", "B", "C", "D"] as const;
const MAX_ATTEMPTS = 3;
/** two independent solvers must agree this closely (students are accepted within 1%) */
const AGREE_TOLERANCE = 0.005;

export interface StreamAsk {
  kind: StreamKind;
  difficulty: Difficulty;
  /** the branch as the generator should name it, e.g. "Mechanical Engineering" */
  branch: string;
  /** a course from the student's curriculum, or null when none is published */
  subject: string | null;
  /** year of study when known */
  year: number | null;
  avoidTitles: readonly string[];
  seed: number;
}

export interface StreamDraft {
  kind: StreamKind;
  title: string;
  category: string;
  difficulty: Difficulty;
  scenario: string;
  objective: string;
  skillTags: string[];
  /** numeric: the official number as text. mcq: the correct option key */
  expected: string;
  answerUnit: string | null;
  options: { key: string; text: string }[] | null;
  explanation: string | null;
}

export interface Deps {
  llm<T>(prompt: string, system: string, schema: z.ZodType<T>): Promise<T>;
  run(source: string, fn: string, cases: unknown[][]): Promise<CaseResult[]>;
}
export const realDeps: Deps = { llm: async (p, s, schema) => (await completeJsonDetailed(p, s, schema, { task: "arena_task", maxTokens: 4000 })).value, run: runInSandbox };

const Base = {
  title: z.string().min(8).max(90),
  category: z.string().min(2).max(60),
  scenario: z.string().min(40).max(900),
  objective: z.string().min(15).max(300),
  skill_tags: z.array(z.string().min(1).max(30)).min(1).max(4),
};
const NumericGen = z.object({ ...Base, answer_unit: z.string().min(1).max(20), solution_js: z.string().min(20).max(3000) });
const McqGen = z.object({ ...Base, options: z.array(z.string().min(1).max(220)).length(4), correct: z.number().int().min(0).max(3), explanation: z.string().min(20).max(700) });
const NumericSolver = z.object({ underspecified: z.boolean(), solution_js: z.string().max(3000).optional() });
const McqSolver = z.object({ choice: z.enum(["A", "B", "C", "D", "NONE"]) });

const LEVEL: Record<Difficulty, string> = {
  easy: "Easy: one standard formula or one clear idea; a student who attended class can do it in a few minutes.",
  medium: "Medium: two linked steps, or a unit conversion, or choosing the right formula from two plausible ones.",
  hard: "Hard: three or more steps, or a realistic situation where one assumption must be applied correctly. Still solvable in about 15 minutes.",
};
const yearWords = (y: number | null) => (y === 2 ? "second-year" : y === 3 ? "third-year" : y && y >= 4 ? "final-year" : "undergraduate");

function brief(ask: StreamAsk, previous?: string): string {
  const subject = ask.subject ? `Subject: ${ask.subject}.` : `Subject: pick one core subject from a typical ${yearWords(ask.year)} ${ask.branch} syllabus, and name it in "category".`;
  return `Write one ${ask.kind === "numeric" ? "calculation problem" : "concept or case question"} for a ${yearWords(ask.year)} ${ask.branch} student.
${subject}
${LEVEL[ask.difficulty]}
${ask.avoidTitles.length ? `Do not reuse or rephrase these earlier titles; pick a different problem:\n- ${ask.avoidTitles.slice(0, 25).join("\n- ")}` : ""}${previous ? `\nYour previous attempt was rejected because: ${previous}. Fix exactly that.` : ""}`;
}

const NUMERIC_SYSTEM = `You write one solvable calculation problem for an engineering, science or management student on a career-readiness platform, plus the code that proves it fair.
Rules:
- The scenario states EVERY value needed, with its unit, and any standard constant used (for example g = 9.81 m/s^2). No missing data, no assumptions left to the student.
- The objective names exactly one quantity and the unit of the final answer.
- Never reveal the answer or a finished intermediate result in the scenario.
- "solution_js" defines function answer() with no parameters. It computes the final number from the stated values by the standard textbook method and returns a JavaScript number in answer_unit.
- Use an Indian setting where money or places appear, with amounts in rupees (₹).
- The answer must be a nonzero, ordinary-sized number.
Respond with JSON only, exactly: {"title","category","scenario","objective","answer_unit","solution_js","skill_tags":[...]}.`;

const MCQ_SYSTEM = `You write one multiple-choice concept or case question for a student on a career-readiness platform.
Rules:
- The question tests understanding of the subject (a principle, a design or process decision, an interpretation of a given situation), not trivia or memorised definitions. Put the situation in "scenario" and the actual question in "objective".
- Exactly 4 options. Exactly one is correct. The wrong options are plausible mistakes a student makes, similar in length and style to the right one. Never use "all of the above" or "none of the above".
- "correct" is the 0-based index of the right option in "options". "explanation" says in 2-3 sentences why it is right.
Respond with JSON only, exactly: {"title","category","scenario","objective","options":[4 strings],"correct","explanation","skill_tags":[...]}.`;

const NUMERIC_SOLVER_SYSTEM = `You are a careful examiner. Solve the problem using the standard textbook method and ONLY the stated values. If a value you need is missing and would have to be assumed, set "underspecified" to true. Otherwise return JavaScript in "solution_js" defining function answer() (no parameters) that returns the final number in the requested unit. JSON only: {"underspecified": boolean, "solution_js": "..."}.`;
const MCQ_SOLVER_SYSTEM = `You are a careful examiner. Read the question and choose the single best option. If no option is correct, or more than one is, answer NONE. JSON only: {"choice": "A" | "B" | "C" | "D" | "NONE"}.`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function number(deps: Deps, source: string, what: string): Promise<number> {
  let result: CaseResult[];
  try {
    result = await deps.run(source, "answer", [[]]);
  } catch (e) {
    throw new GenerationRejected(`${what} would not run: ${(e as Error).message}`);
  }
  const v = result[0];
  if (!v?.ok || typeof v.value !== "number" || !Number.isFinite(v.value)) throw new GenerationRejected(`${what} did not return a number`);
  return v.value;
}

async function numeric(ask: StreamAsk, deps: Deps, previous?: string): Promise<StreamDraft> {
  const raw = await deps.llm(brief(ask, previous), NUMERIC_SYSTEM, NumericGen);
  if (ask.avoidTitles.some((t) => norm(t) === norm(raw.title))) throw new GenerationRejected("title repeats an earlier challenge");
  const value = await number(deps, raw.solution_js, "the solution");
  if (value === 0 || Math.abs(value) >= 1e12 || Math.abs(value) < 1e-6) throw new GenerationRejected("the answer must be a nonzero, ordinary-sized number");
  const expected = Number(value.toPrecision(6));
  if (raw.scenario.replace(/,/g, "").includes(String(expected))) throw new GenerationRejected("the answer already appears in the scenario");

  // the independent solver sees only what a student sees
  const second = await deps.llm(`Problem:\n${raw.scenario}\n\nTask: ${raw.objective}\nAnswer unit: ${raw.answer_unit}`, NUMERIC_SOLVER_SYSTEM, NumericSolver);
  if (second.underspecified || !second.solution_js) throw new GenerationRejected("an independent solver says the scenario is missing a value");
  const other = await number(deps, second.solution_js, "the independent solution");
  if (Math.abs(other - expected) > Math.abs(expected) * AGREE_TOLERANCE) throw new GenerationRejected(`two independent solutions disagree (${expected} vs ${other})`);

  return { kind: "numeric", title: raw.title, category: raw.category, difficulty: ask.difficulty, scenario: raw.scenario, objective: raw.objective, skillTags: raw.skill_tags, expected: String(expected), answerUnit: raw.answer_unit, options: null, explanation: null };
}

async function mcq(ask: StreamAsk, deps: Deps, previous?: string): Promise<StreamDraft> {
  const raw = await deps.llm(brief(ask, previous), MCQ_SYSTEM, McqGen);
  if (ask.avoidTitles.some((t) => norm(t) === norm(raw.title))) throw new GenerationRejected("title repeats an earlier challenge");
  if (new Set(raw.options.map(norm)).size < 4) throw new GenerationRejected("two options say the same thing");
  if (raw.options.some((o) => /\b(all|none) of the above\b/i.test(o))) throw new GenerationRejected('"all/none of the above" does not survive shuffling');

  const shuffled = makeRng(ask.seed).shuffle(raw.options.map((text, i) => ({ text, right: i === raw.correct })));
  const options = shuffled.map((o, i) => ({ key: OPTION_KEYS[i], text: o.text }));
  const expected = OPTION_KEYS[shuffled.findIndex((o) => o.right)];

  const lettered = options.map((o) => `${o.key}. ${o.text}`).join("\n");
  const second = await deps.llm(`Situation:\n${raw.scenario}\n\nQuestion: ${raw.objective}\n\n${lettered}`, MCQ_SOLVER_SYSTEM, McqSolver);
  if (second.choice !== expected) throw new GenerationRejected(`an independent solver chose ${second.choice}, not the intended answer, so the question is ambiguous or wrong`);

  return { kind: "mcq", title: raw.title, category: raw.category, difficulty: ask.difficulty, scenario: raw.scenario, objective: raw.objective, skillTags: raw.skill_tags, expected, answerUnit: null, options, explanation: raw.explanation };
}

/** One attempt. Throws GenerationRejected with the first reason the challenge is not fair. */
export function generateStreamDraft(ask: StreamAsk, deps: Deps = realDeps, previous?: string): Promise<StreamDraft> {
  return ask.kind === "numeric" ? numeric(ask, deps, previous) : mcq(ask, deps, previous);
}

/**
 * Up to MAX_ATTEMPTS tries: the asked kind (the second try is told why the first failed), then the other kind, because some subjects
 * (a management case, a design principle) simply do not reduce to one number. Returns null when nothing proved itself.
 */
export async function generateWithRetry(ask: StreamAsk, deps: Deps = realDeps): Promise<{ draft: StreamDraft | null; reasons: string[] }> {
  const reasons: string[] = [];
  const other: StreamKind = ask.kind === "numeric" ? "mcq" : "numeric";
  const tries: { kind: StreamKind; previous?: string }[] = [{ kind: ask.kind }, { kind: ask.kind }, { kind: other }];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const draft = await generateStreamDraft({ ...ask, kind: tries[i].kind, seed: ask.seed + i }, deps, i === 1 ? reasons[0] : undefined);
      return { draft, reasons };
    } catch (e) {
      reasons.push((e as Error).message.slice(0, 160));
      if (!(e instanceof GenerationRejected) && !(e instanceof z.ZodError)) {
        if (/rate|429|quota|unavailable|timeout|ECONN/i.test((e as Error).message)) break; // a provider outage will not clear in this loop
      }
    }
  }
  return { draft: null, reasons };
}
