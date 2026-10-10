import { runCode, isSupportedLanguage, type RunResult } from "@/lib/code-execution/wandbox";

export interface JudgeTest {
  input: string;
  output: string;
}

export type Runner = (language: string, code: string, stdin: string) => Promise<RunResult>;

/** Whitespace-tolerant comparison: trailing spaces per line and blank lines at the ends do not matter, everything else does. */
export const normalizeOutput = (s: string) => s.replace(/\r/g, "").split("\n").map((l) => l.trimEnd()).join("\n").trim();
export const outputsMatch = (actual: string, expected: string) => normalizeOutput(actual) === normalizeOutput(expected);

/** Runs `worker` over `items` with at most `limit` in flight (the public code runner is shared, so we stay polite). */
export async function mapLimit<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i], i);
      }
    })
  );
  return out;
}

/** Runs one program over many stdin inputs and returns one result per input, in order. */
export type Executor = (language: string, code: string, inputs: readonly string[]) => Promise<RunResult[]>;

/** One run per input (any language). */
export const perTest = (run: Runner, limit = RUN_CONCURRENCY): Executor => (language, code, inputs) => mapLimit(inputs, limit, (input) => run(language, code, input));

const TEST_SECONDS = 3;

/**
 * A single Python program that runs the student's code once per input (stdin swapped per run, output captured, a per-input time limit)
 * and prints one JSON array. One request to the shared runner instead of one per test: it is slow (seconds per call) and drops
 * parallel requests, so six tests would otherwise take most of a minute.
 */
export function pythonHarness(code: string, inputs: readonly string[]): string {
  return `import sys, io, json, signal
CODE = json.loads(${JSON.stringify(JSON.stringify(code))})
INPUTS = json.loads(${JSON.stringify(JSON.stringify(inputs))})
class TimedOut(BaseException): pass
def _alarm(*a): raise TimedOut()
signal.signal(signal.SIGALRM, _alarm)
real_out = sys.stdout
results = []
for text in INPUTS:
    sys.stdin = io.StringIO(text)
    buf = io.StringIO()
    sys.stdout = buf
    err = ""
    signal.setitimer(signal.ITIMER_REAL, ${TEST_SECONDS})
    try:
        exec(compile(CODE, "solution.py", "exec"), {"__name__": "__main__"})
    except SystemExit:
        pass
    except TimedOut:
        err = "Time limit exceeded"
    except BaseException as e:
        err = type(e).__name__ + ": " + str(e)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
    sys.stdout = real_out
    results.append({"out": buf.getvalue()[:20000], "err": err})
print(json.dumps(results))
`;
}

/** Real executor: Python goes through the batch harness in one request, other languages one request per input. */
export const wandboxExecutor: Executor = async (language, code, inputs) => {
  if (language !== "python") return perTest(withRetry(runCode), 2)(language, code, inputs);
  const r = await withRetry(runCode)("python", pythonHarness(code, inputs), "");
  try {
    const rows = JSON.parse(r.stdout.trim().split("\n").pop() ?? "") as { out: string; err: string }[];
    if (!Array.isArray(rows) || rows.length !== inputs.length) throw new Error("bad shape");
    return rows.map((x) => ({ stdout: x.out, stderr: x.err, compileError: "" }));
  } catch {
    // the harness itself did not finish (timeout of the whole run, crash): report that for every input instead of a pass
    const why = r.compileError || r.stderr || "The program did not finish (time limit or crash).";
    return inputs.map(() => ({ stdout: "", stderr: why, compileError: "" }));
  }
};

export interface TestVerdict {
  index: number;
  passed: boolean;
  actual: string;
  /** compile error or runtime stderr, when there is no usable output */
  error: string;
}

export const RUN_CONCURRENCY = 3;

/** Runs the student's code on every test. A run that throws (service down) is reported as an error, never as a pass. */
export async function judge(language: string, code: string, tests: readonly JudgeTest[], exec: Executor = wandboxExecutor): Promise<TestVerdict[]> {
  if (!isSupportedLanguage(language)) throw new Error(`Unsupported language: ${language}`);
  let results: RunResult[];
  try {
    results = await exec(language, code, tests.map((t) => t.input));
  } catch {
    return tests.map((_, index) => ({ index, passed: false, actual: "", error: "Code execution service is unavailable. Try again." }));
  }
  return tests.map((t, index) => {
    const r = results[index];
    const error = r.compileError || (r.stdout.trim() === "" ? r.stderr : "");
    return { index, passed: !r.compileError && outputsMatch(r.stdout, t.output), actual: r.stdout, error };
  });
}

/** The shared public code runner drops requests now and then: retry a failed run a couple of times before calling it unavailable. */
export function withRetry(run: Runner, waits: readonly number[] = [1500, 4000], sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Runner {
  return async (language, code, stdin) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await run(language, code, stdin);
      } catch (e) {
        if (attempt >= waits.length) throw e;
        await sleep(waits[attempt]);
      }
    }
  };
}
