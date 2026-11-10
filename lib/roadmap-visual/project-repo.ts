import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { fetchWithBackoff } from "@/lib/code-dna/github-scan";
import { fetchBlobText, fetchTree, isSourceFile, selectProbeFiles, type TreeFile } from "@/lib/code-dna/originality";
import { ownerCheck, type RepoContext } from "./project-submission";

const FILES_READ = 6;
const FILE_CHARS = 1500;
const README_FILE = /^readme(\.md|\.rst|\.txt)?$/i;
const NON_LOGIC_PATH = /(^|\/)(tests?|__tests__|spec|bench(marks?)?|examples?|fixtures?)(\/|\.|$)|\.(test|spec)\./i;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export type RepoLoad =
  | { ok: true; context: RepoContext; isFork: boolean }
  | { ok: false; reason: "not_found" | "empty" | "unavailable" };

/** The student's verified GitHub username, if they connected and verified one. */
export async function verifiedGithubUsername(service: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data } = await untyped(service).from("github_connections").select("username, verification_state").eq("user_id", userId).maybeSingle();
  const row = data as { username: string; verification_state: string } | null;
  return row && row.verification_state === "verified" ? row.username : null;
}

/**
 * Reads a public repository the way a reviewer would first: its description, README, the list of files and the largest source files (up to
 * FILES_READ, tests only when there is little else). It does not read every file, and it never reads a private repository.
 */
export async function loadProjectRepo(fullName: string, verifiedUsername: string | null): Promise<RepoLoad> {
  let meta: { owner?: { login?: string }; fork?: boolean; description?: string | null; language?: string | null };
  try {
    const res = await fetchWithBackoff(`https://api.github.com/repos/${fullName}`);
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    meta = (await res.json()) as typeof meta;
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const tree: TreeFile[] = await fetchTree(fullName).catch(() => []);
  const sourceFiles = tree.filter(isSourceFile);
  if (sourceFiles.length === 0) return { ok: false, reason: "empty" };

  const readmeFile = tree.find((f) => !f.path.includes("/") && README_FILE.test(f.path));
  const logic = sourceFiles.filter((f) => !NON_LOGIC_PATH.test(f.path));
  const picked = selectProbeFiles(logic, FILES_READ);
  if (picked.length < FILES_READ) picked.push(...selectProbeFiles(sourceFiles.filter((f) => !picked.includes(f)), FILES_READ - picked.length));
  const [readme, ...contents] = await Promise.all([readmeFile ? fetchBlobText(fullName, readmeFile.sha) : Promise.resolve(null), ...picked.map((f) => fetchBlobText(fullName, f.sha))]);
  const files = picked.flatMap((f, i) => (contents[i] ? [{ path: f.path, excerpt: clip(contents[i] as string, FILE_CHARS) }] : []));
  if (files.length === 0) return { ok: false, reason: "unavailable" };

  const owner = meta.owner?.login ?? fullName.split("/")[0];
  return {
    ok: true,
    isFork: Boolean(meta.fork),
    context: { fullName, description: meta.description ?? null, language: meta.language ?? null, readme: readme ?? "", paths: tree.map((t) => t.path), files, owner: ownerCheck(owner, verifiedUsername) },
  };
}
