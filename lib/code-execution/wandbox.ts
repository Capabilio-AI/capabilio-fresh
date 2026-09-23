// Piston (originally planned — free, public, no API key) went
// whitelist-only in Feb 2026: authorization is discretionary, granted
// only for "good cause non-commercial educational projects", and
// explicitly excludes AI-generated projects. Wandbox is the swap — also
// free, public, no API key, and has run continuously for years as the
// de facto public code-runner for the competitive-programming community.
const WANDBOX_URL = "https://wandbox.org/api/compile.json";

// Pinned to specific Wandbox compiler names (verified working — see the
// git history for this file). "latest" isn't a valid compiler id here.
const COMPILER_BY_LANGUAGE: Record<string, string> = {
  python: "cpython-3.10.15",
  c: "gcc-13.2.0-c",
};

export type SupportedLanguage = keyof typeof COMPILER_BY_LANGUAGE;

export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return language in COMPILER_BY_LANGUAGE;
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

export async function runCode(language: string, code: string, stdin: string): Promise<RunResult> {
  const compiler = COMPILER_BY_LANGUAGE[language];
  if (!compiler) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const res = await fetch(WANDBOX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, compiler, stdin }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Code execution service returned ${res.status}`);
  }

  const data = (await res.json()) as WandboxResponse;
  return {
    stdout: data.program_output ?? "",
    stderr: data.program_error ?? "",
    compileError: data.compiler_error ?? "",
  };
}
