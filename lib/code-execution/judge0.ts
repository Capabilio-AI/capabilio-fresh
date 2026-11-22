// Self-hosted Judge0 (open-source judge, runs in Docker). Used instead of the shared public Wandbox when JUDGE0_URL is set.
//   JUDGE0_URL=https://judge.example.com   JUDGE0_TOKEN=...   (optional X-Auth-Token)
import type { RunResult } from "./wandbox";

/**
 * Judge0 language ids. python, java, javascript and csharp use OUR ids (102, 101, 103, 104): the stock Judge0 has Python 3.8, Java 13, Node 12 and Mono, too old
 * for what the lessons teach (match, records, switch expressions, ??, top-level C#). They exist only on the custom image in infra/judge0 (Dockerfile + capabilio-languages.rb);
 * against a stock Judge0 they are unknown ids, so run `npm run judge:health` after any runner change.
 */
export const JUDGE0_IDS: Record<string, number> = { python: 102, c: 50, cpp: 54, java: 101, javascript: 103, typescript: 74, ruby: 72, php: 68, go: 60, rust: 73, csharp: 104, kotlin: 78 };
export const judge0Configured = (): boolean => Boolean(process.env.JUDGE0_URL);

interface Judge0Response { stdout: string | null; stderr: string | null; compile_output: string | null; message: string | null; status: { id: number; description: string } }

// Judge0 refuses to answer in plain text when a program (or the compiler) prints bytes that are not valid UTF-8, which a student's buggy C or C++ can do;
// base64 both ways always works, and bad bytes become the replacement character here instead of an error there.
const toB64 = (s: string): string => Buffer.from(s, "utf8").toString("base64");
const fromB64 = (s: string | null): string | null => (s == null ? null : Buffer.from(s, "base64").toString("utf8"));

export async function runOnJudge0(language: string, code: string, stdin: string, fetchImpl: typeof fetch = fetch): Promise<RunResult> {
  const id = JUDGE0_IDS[language];
  if (!id) throw new Error(`Unsupported language: ${language}`);
  const res = await fetchImpl(`${process.env.JUDGE0_URL}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.JUDGE0_TOKEN ? { "X-Auth-Token": process.env.JUDGE0_TOKEN } : {}) },
    body: JSON.stringify({ language_id: id, source_code: toB64(code), stdin: toB64(stdin), cpu_time_limit: 4, wall_time_limit: 10, memory_limit: 256_000 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Code execution service returned ${res.status}`);
  const raw = (await res.json()) as Partial<Judge0Response> & { error?: string };
  // an answer with no status means the judge could not run the submission at all: the code was never graded, so the caller may retry
  if (!raw.status) throw new Error(`Code execution service is busy (${raw.error ?? "no status"})`);
  const d: Judge0Response = { ...(raw as Judge0Response), stdout: fromB64(raw.stdout ?? null), stderr: fromB64(raw.stderr ?? null), compile_output: fromB64(raw.compile_output ?? null), message: fromB64(raw.message ?? null) };
  // 13 = internal error: the judge itself failed, so the code was never graded and the caller may retry
  if (d.status.id === 13) throw new Error("Code execution service is busy");
  return {
    stdout: d.stdout ?? "",
    stderr: d.status.id === 5 ? "Time limit exceeded" : (d.stderr ?? "") || (d.status.id >= 7 && d.status.id <= 12 ? d.status.description : ""),
    compileError: d.status.id === 6 ? (d.compile_output ?? "Compilation failed") : "",
  };
}
