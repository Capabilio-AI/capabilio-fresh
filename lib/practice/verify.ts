import { outputsMatch, type ExerciseTest, type GeneratedExercise, type RunnableLanguage } from "./practice";

export interface RunOutput { stdout: string; stderr: string; compileError: string }
/** The code runner, passed in so this can be tested without one. */
export type Runner = (language: RunnableLanguage, code: string, stdin: string) => Promise<RunOutput>;

const passes = (r: RunOutput, expected: string) => !r.compileError && outputsMatch(r.stdout, expected);

export interface RetryDeps { tries?: number; sleep?: (ms: number) => Promise<void> }
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One run, tried again when the shared runner is busy or times out (it throws then, and the code was never run). Null means it never ran, which
 * is the runner's problem: callers must not count it as a wrong answer.
 */
export async function runReliably(run: Runner, language: RunnableLanguage, code: string, stdin: string, deps: RetryDeps = {}): Promise<RunOutput | null> {
  const tries = deps.tries ?? 3;
  for (let i = 0; i < tries; i++) {
    try {
      return await run(language, code, stdin);
    } catch {
      if (i < tries - 1) await (deps.sleep ?? realSleep)(2000 * (i + 1));
    }
  }
  return null;
}

/**
 * Runs the model's own solution on its own tests, and its starter code on the first one. An exercise is kept only when the solution passes
 * every test (visible and hidden) and the starter does not already solve it: a wrong "reference answer" or a free pass never reaches a student.
 */
export async function verifyExercise(ex: GeneratedExercise, language: RunnableLanguage, run: Runner, deps: RetryDeps = {}): Promise<{ ok: true } | { ok: false; reason: string; infra: boolean }> {
  const runs = await Promise.all(ex.tests.map((t) => runReliably(run, language, ex.solution, t.input, deps)));
  // a run that never happened says nothing about the exercise: report it as the runner's trouble, not as a wrong solution
  if (runs.some((r) => r === null)) return { ok: false, reason: "the code runner was busy or unreachable", infra: true };
  const bad = ex.tests.map((t, i) => ({ t, r: runs[i] as RunOutput })).filter(({ t, r }) => !passes(r, t.expected));
  if (bad.length > 0) {
    const { t, r } = bad[0];
    const why = r.compileError ? `compile error: ${r.compileError}` : `expected ${JSON.stringify(t.expected)} but it printed ${JSON.stringify((r.stdout || r.stderr).slice(0, 120))}`;
    return { ok: false, reason: `the solution failed ${bad.length} of ${ex.tests.length} tests (first: ${why.replace(/\s+/g, " ").slice(0, 220)})`, infra: false };
  }
  const first = ex.tests[0];
  const starter = await runReliably(run, language, ex.starterCode, first.input, deps);
  if (starter === null) return { ok: false, reason: "the code runner was busy or unreachable", infra: true };
  if (passes(starter, first.expected)) return { ok: false, reason: "the starter code already solves it", infra: false };
  return { ok: true };
}

export type TestResult = { hidden: false; pass: boolean; input: string; expected: string; got: string } | { hidden: true; pass: boolean };
export interface CheckOutcome {
  passed: boolean;
  results: TestResult[];
  /** a compile or run error from the student's code, shown as is */
  error: string | null;
  /** the runner could not run the tests at all (busy or unreachable): nothing was graded, so this must not count as an attempt */
  unavailable: boolean;
}

const clip = (s: string) => (s.length > 600 ? `${s.slice(0, 600)}…` : s);

/**
 * Runs a student's code on every test. Visible tests come back with the input, what was expected and what the code printed; a hidden test
 * only says pass or fail, so its answer can never be read off the result.
 */
export async function checkAgainstTests(language: RunnableLanguage, code: string, tests: ExerciseTest[], run: Runner, deps: RetryDeps = {}): Promise<CheckOutcome> {
  const outputs = await Promise.all(tests.map((t) => runReliably(run, language, code, t.input, deps)));
  if (outputs.some((o) => o === null)) return { passed: false, results: [], error: null, unavailable: true };
  const outs = outputs as RunOutput[];
  const results: TestResult[] = tests.map((t, i) => {
    const pass = passes(outs[i], t.expected);
    return t.hidden ? { hidden: true, pass } : { hidden: false, pass, input: t.input, expected: t.expected, got: clip(outs[i].stdout || outs[i].stderr) };
  });
  const error = outs.map((o) => o.compileError).find(Boolean) ?? null;
  return { passed: results.every((r) => r.pass), results, error: error ? clip(error) : null, unavailable: false };
}
