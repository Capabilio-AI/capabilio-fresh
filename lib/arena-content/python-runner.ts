import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs authored reference Python with the local interpreter, in a throwaway directory with a time limit. For admin tooling that validates
 * content a trusted author wrote -- never call this with student code.
 */
export async function runLocalPython(source: string, timeoutMs = 20_000): Promise<{ stdout: string; error: string | null }> {
  const dir = await mkdtemp(join(tmpdir(), "arena-ref-"));
  try {
    await writeFile(join(dir, "ref.py"), source);
    return await new Promise((resolve) => {
      execFile("python3", ["-I", "ref.py"], { cwd: dir, timeout: timeoutMs, maxBuffer: 1_000_000 }, (error, stdout, stderr) =>
        resolve({ stdout, error: error ? (stderr || error.message).trim().split("\n").slice(-3).join(" ") : null })
      );
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
