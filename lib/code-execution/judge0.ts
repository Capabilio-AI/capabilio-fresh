// Self-hosted Judge0 (open-source judge, runs in Docker). Used instead of the shared public Wandbox when JUDGE0_URL is set.
//   JUDGE0_URL=https://judge.example.com   JUDGE0_TOKEN=...   (optional X-Auth-Token)
import type { RunResult } from "./wandbox";

/** Judge0 CE language ids */
export const JUDGE0_IDS: Record<string, number> = { python: 71, c: 50, cpp: 54, java: 62, javascript: 63, typescript: 74, ruby: 72, php: 68, go: 60, rust: 73, csharp: 51, kotlin: 78 };
export const judge0Configured = (): boolean => Boolean(process.env.JUDGE0_URL);

interface Judge0Response { stdout: string | null; stderr: string | null; compile_output: string | null; message: string | null; status: { id: number; description: string } }

export async function runOnJudge0(language: string, code: string, stdin: string, fetchImpl: typeof fetch = fetch): Promise<RunResult> {
  const id = JUDGE0_IDS[language];
  if (!id) throw new Error(`Unsupported language: ${language}`);
  const res = await fetchImpl(`${process.env.JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.JUDGE0_TOKEN ? { "X-Auth-Token": process.env.JUDGE0_TOKEN } : {}) },
    body: JSON.stringify({ language_id: id, source_code: code, stdin, cpu_time_limit: 4, wall_time_limit: 10, memory_limit: 256_000 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Code execution service returned ${res.status}`);
  const d = (await res.json()) as Judge0Response;
  // 13 = internal error: the judge itself failed, so the code was never graded and the caller may retry
  if (d.status.id === 13) throw new Error("Code execution service is busy");
  return {
    stdout: d.stdout ?? "",
    stderr: d.status.id === 5 ? "Time limit exceeded" : (d.stderr ?? "") || (d.status.id >= 7 && d.status.id <= 12 ? d.status.description : ""),
    compileError: d.status.id === 6 ? (d.compile_output ?? "Compilation failed") : "",
  };
}
