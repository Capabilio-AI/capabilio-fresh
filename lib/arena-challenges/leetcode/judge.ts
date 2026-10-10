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

export interface TestVerdict {
  index: number;
  passed: boolean;
  actual: string;
  /** compile error or runtime stderr, when there is no usable output */
  error: string;
}

export const RUN_CONCURRENCY = 3;

/** Runs the student's code on every test. A run that throws (service down) is reported as an error, never as a pass. */
export async function judge(language: string, code: string, tests: readonly JudgeTest[], run: Runner = runCode): Promise<TestVerdict[]> {
  if (!isSupportedLanguage(language)) throw new Error(`Unsupported language: ${language}`);
  return mapLimit(tests, RUN_CONCURRENCY, async (t, index) => {
    try {
      const r = await run(language, code, t.input);
      const error = r.compileError || (r.stdout.trim() === "" ? r.stderr : "");
      return { index, passed: !r.compileError && outputsMatch(r.stdout, t.output), actual: r.stdout, error };
    } catch {
      return { index, passed: false, actual: "", error: "Code execution service is unavailable. Try again." };
    }
  });
}
