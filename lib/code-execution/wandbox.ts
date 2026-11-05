// Piston (originally planned — free, public, no API key) went
// whitelist-only in Feb 2026: authorization is discretionary, granted
// only for "good cause non-commercial educational projects", and
// explicitly excludes AI-generated projects. Wandbox is the swap — also
// free, public, no API key, and has run continuously for years as the
// de facto public code-runner for the competitive-programming community.
import { JUDGE0_IDS, judge0Configured, runOnJudge0 } from "./judge0";

const WANDBOX_URL = "https://wandbox.org/api/compile.json";

// Pinned to specific Wandbox compiler names (verified working — see the
// git history for this file). "latest" isn't a valid compiler id here.
const COMPILER_BY_LANGUAGE: Record<string, string> = {
  python: "cpython-3.10.15",
  c: "gcc-13.2.0-c",
  cpp: "gcc-13.2.0",
  java: "openjdk-jdk-21+35",
  javascript: "nodejs-20.17.0",
  typescript: "typescript-5.6.2",
  ruby: "ruby-3.4.9",
  php: "php-8.3.12",
};
// compiled and slower-starting languages get a longer wait on the shared runner
const TIMEOUT_MS: Record<string, number> = { python: 15_000, c: 20_000, cpp: 25_000, java: 40_000, javascript: 20_000, typescript: 40_000, ruby: 30_000, php: 30_000 };
// Wandbox compiles Java as prog.java, where a public class is an error: students may write the usual `public class Main`
const prepare = (language: string, code: string) => (language === "java" ? code.replace(/\bpublic\s+(final\s+)?class\b/g, "$1class") : code);

export type SupportedLanguage = keyof typeof COMPILER_BY_LANGUAGE;

export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return language in COMPILER_BY_LANGUAGE || (judge0Configured() && language in JUDGE0_IDS);
}

export interface RunResult {
  stdout: string;
  stderr: string;
  compileError: string;
}

interface WandboxResponse {
  status?: string;
  signal?: string;
  compiler_error?: string;
  program_output?: string;
  program_error?: string;
}

// The shared runner drops requests when many arrive at once, so this process never has more than two in flight.
const MAX_IN_FLIGHT = 2;
let inFlight = 0;
const waiting: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight++;
  try {
    return await work();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}
/** the runner's own capacity errors (its container could not start): the student's code never ran, so this is retried, not graded */
const OVERLOAD = /OCI runtime error|Resource temporarily unavailable|Unexpected Server Error|too many requests/i;

export const runCode = (language: string, code: string, stdin: string): Promise<RunResult> =>
  judge0Configured() ? runOnJudge0(language, code, stdin) : slot(() => runOnce(language, code, stdin));

async function runOnce(language: string, code: string, stdin: string): Promise<RunResult> {
  const compiler = COMPILER_BY_LANGUAGE[language];
  if (!compiler) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const res = await fetch(WANDBOX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: prepare(language, code), compiler, stdin }),
    signal: AbortSignal.timeout(TIMEOUT_MS[language] ?? 20_000),
  });
  if (!res.ok) {
    throw new Error(`Code execution service returned ${res.status}`);
  }

  const data = (await res.json()) as WandboxResponse;
  if (OVERLOAD.test(`${data.compiler_error ?? ""} ${data.program_error ?? ""}`)) throw new Error("Code execution service is busy");
  return {
    stdout: data.program_output ?? "",
    stderr: data.program_error ?? "",
    compileError: data.compiler_error ?? "",
  };
}
