import { fetchWithBackoff, hasGithubToken, type FullRepoAnalysis } from "./github-scan";

// Content fingerprinting -- "is this code actually someone else's?" -- done
// without downloading anyone's repository. Two exact, cheap checks:
//   1. Probe: take a distinctive line from the candidate's biggest source
//      files, find other public repos containing it (GitHub code search).
//   2. Compare: git blob SHAs are content hashes, so equal SHAs mean
//      byte-identical files. Count how many of the candidate's source files
//      appear unchanged in each match, and line-compare the probe files to
//      catch light edits.
// Ceiling (deliberate): a file with renamed variables or reformatting has a
// different hash, and a code-search miss means no candidate is found. This
// under-detects rather than over-claims. A match only counts when the other
// repository is OLDER than this one -- copies made later are the other
// direction and are reported as a positive, not a flag.

const GITHUB_API = "https://api.github.com";
export const ORIGINALITY_MAX_REPOS = 6;
const PROBES_PER_REPO = 2;
const MAX_CANDIDATES_PER_REPO = 2;
const CODE_SEARCH_SPACING_MS = 6500; // code search allows ~10 requests/minute
const MIN_SOURCE_FILES = 5;
const MIN_PROBE_BYTES = 600;
const MAX_PROBE_BYTES = 60_000;
const MIN_FINGERPRINT_BYTES = 400;
const NEAR_COPY_OVERLAP = 0.85;

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|py|java|go|rs|rb|php|cs|cpp|c|h|kt|swift|dart|vue|svelte|sql|html|css|scss)$/i;
const EXCLUDED_PATH = /(^|\/)(node_modules|vendor|dist|build|out|\.next|__pycache__|venv|\.venv|coverage|public|assets|migrations)\//i;
const EXCLUDED_NAME = /(\.min\.|\.d\.ts$|\.config\.|(^|\/)(package-lock|yarn\.lock|setupTests|reportWebVitals)\b)/i;
const SKIP_LINE_START = /^(import |from |export \*|require\(|use |\/\/|#|\*|\/\*|<!--|@)/;

export type TreeFile = { path: string; sha: string; size: number };
export type SimilarityLevel = "low" | "moderate" | "high";

export type OriginalityMatch = {
  repoName: string;
  matchedRepoFullName: string;
  matchedRepoUrl: string;
  level: SimilarityLevel;
  identicalFiles: number;
  comparedFiles: number;
  nearCopyProbes: number;
  matchedRepoCreatedAt: string;
  matchedRepoStars: number;
  explanations: string[];
};

export type OriginalityReport = {
  status: "checked" | "unavailable";
  eligibleRepos: number;
  checkedRepos: number;
  matches: OriginalityMatch[];
  /** Repos of this profile that other public repos copied from later. */
  copiedByOthers: { repoName: string; matchedRepoFullName: string; identicalFiles: number }[];
  ranAt: string;
};

export function isSourceFile(file: TreeFile): boolean {
  return SOURCE_EXT.test(file.path) && !EXCLUDED_PATH.test(file.path) && !EXCLUDED_NAME.test(file.path) && file.size >= MIN_FINGERPRINT_BYTES;
}

/** Pure + deterministic: the biggest source files carry the most original logic. */
export function selectProbeFiles(files: TreeFile[], count: number): TreeFile[] {
  return files
    .filter((f) => isSourceFile(f) && f.size >= MIN_PROBE_BYTES && f.size <= MAX_PROBE_BYTES)
    .sort((a, b) => b.size - a.size || a.path.localeCompare(b.path))
    .slice(0, count);
}

/** Pure. The longest meaningful line, since long lines are the least likely to collide by chance. */
export function pickDistinctiveLine(content: string): string | null {
  const candidates = content
    .split("\n")
    .map((l) => l.trim().replace(/["\\]/g, ""))
    .filter((l) => l.length >= 50 && l.length <= 140 && !SKIP_LINE_START.test(l) && /[a-z]{3,}\s+[a-z]{2,}/i.test(l));
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

const normalizeLines = (content: string): Set<string> =>
  new Set(
    content
      .split("\n")
      .map((l) => l.trim().replace(/\s+/g, " "))
      .filter((l) => l.length >= 12 && /[a-z0-9]/i.test(l))
  );

/** Pure. Share of `a`'s meaningful lines that also appear in `b` (0-1). */
export function lineOverlap(a: string, b: string): number {
  const lines = normalizeLines(a);
  if (lines.size === 0) return 0;
  const other = normalizeLines(b);
  let shared = 0;
  for (const line of lines) if (other.has(line)) shared += 1;
  return shared / lines.size;
}

export function classifyOverlap(args: { identicalFiles: number; comparedFiles: number; nearCopyProbes: number }): SimilarityLevel | null {
  const share = args.comparedFiles > 0 ? args.identicalFiles / args.comparedFiles : 0;
  if ((args.identicalFiles >= 5 && share >= 0.5) || args.nearCopyProbes >= 2) return "high";
  if ((args.identicalFiles >= 3 && share >= 0.2) || args.nearCopyProbes >= 1) return "moderate";
  return null;
}

const EXPLANATIONS: Record<"high" | "moderate", string[]> = {
  high: ["Open-source project or starter template this repository was built from", "Code carried over from the candidate's own earlier work", "Copied implementation. Review recommended"],
  moderate: ["Shared starter template or boilerplate", "Adapted implementation of a public project", "Common snippet reused across projects"],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchTree(fullName: string): Promise<TreeFile[]> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${fullName}/git/trees/HEAD?recursive=1`);
  if (!res.ok) return [];
  const body = (await res.json()) as { tree?: { path: string; sha: string; size?: number; type: string }[] };
  return (body.tree ?? []).filter((t) => t.type === "blob").map((t) => ({ path: t.path, sha: t.sha, size: t.size ?? 0 }));
}

export async function fetchBlobText(fullName: string, sha: string): Promise<string | null> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${fullName}/git/blobs/${sha}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: string; encoding?: string };
  return body.encoding === "base64" && body.content ? Buffer.from(body.content, "base64").toString("utf-8") : null;
}

type SearchHit = { repoFullName: string; blobSha: string };

async function searchCodeForLine(line: string, excludeOwner: string): Promise<SearchHit[]> {
  const res = await fetchWithBackoff(`${GITHUB_API}/search/code?q=${encodeURIComponent(`"${line}"`)}&per_page=10`);
  if (!res.ok) return [];
  const body = (await res.json()) as { items?: { sha: string; repository: { full_name: string; owner: { login: string } } }[] };
  return (body.items ?? [])
    .filter((i) => i.repository.owner.login.toLowerCase() !== excludeOwner.toLowerCase())
    .map((i) => ({ repoFullName: i.repository.full_name, blobSha: i.sha }));
}

interface RepoMeta {
  html_url: string;
  created_at: string;
  stargazers_count: number;
}

async function fetchRepoMeta(fullName: string): Promise<RepoMeta | null> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${fullName}`);
  return res.ok ? ((await res.json()) as RepoMeta) : null;
}

/** Eligible = original, active-looking repos where this profile has commits, biggest first. */
export function selectOriginalityTargets(repos: FullRepoAnalysis[]): FullRepoAnalysis[] {
  return repos
    .filter((r) => !r.isFork && !r.isArchived && r.scanStatus !== "failed" && r.candidateCommitCount > 0)
    .sort((a, b) => b.candidateCommitCount - a.candidateCommitCount || b.sizeKb - a.sizeKb);
}

async function checkOneRepo(
  username: string,
  repo: FullRepoAnalysis,
  deadline: number
): Promise<{ matches: OriginalityMatch[]; copiedByOthers: OriginalityReport["copiedByOthers"] }> {
  const empty = { matches: [], copiedByOthers: [] };
  const tree = await fetchTree(repo.fullName);
  const sourceFiles = tree.filter(isSourceFile);
  if (sourceFiles.length < MIN_SOURCE_FILES) return empty;

  const probes = selectProbeFiles(sourceFiles, PROBES_PER_REPO);
  const hitsByRepo = new Map<string, { probeCount: number; blobShas: string[]; probes: { content: string; blobSha: string }[] }>();

  for (const probe of probes) {
    if (Date.now() > deadline) break;
    const content = await fetchBlobText(repo.fullName, probe.sha);
    const line = content ? pickDistinctiveLine(content) : null;
    if (!content || !line) continue;
    await sleep(CODE_SEARCH_SPACING_MS);
    for (const hit of await searchCodeForLine(line, username)) {
      if (hit.repoFullName === repo.forkSourceFullName) continue;
      const entry = hitsByRepo.get(hit.repoFullName) ?? { probeCount: 0, blobShas: [], probes: [] };
      entry.probeCount += 1;
      entry.blobShas.push(hit.blobSha);
      entry.probes.push({ content, blobSha: hit.blobSha });
      hitsByRepo.set(hit.repoFullName, entry);
    }
  }

  const candidates = [...hitsByRepo.entries()].sort((a, b) => b[1].probeCount - a[1].probeCount).slice(0, MAX_CANDIDATES_PER_REPO);
  const candidateSince = repo.firstCandidateCommitAt ?? repo.repoCreatedAt ?? "";
  const matches: OriginalityMatch[] = [];
  const copiedByOthers: OriginalityReport["copiedByOthers"] = [];

  for (const [fullName, entry] of candidates) {
    if (Date.now() > deadline) break;
    const [meta, otherTree] = await Promise.all([fetchRepoMeta(fullName), fetchTree(fullName)]);
    if (!meta) continue;

    const otherShas = new Set(otherTree.map((f) => f.sha));
    const identicalFiles = sourceFiles.filter((f) => otherShas.has(f.sha)).length;

    let nearCopyProbes = 0;
    for (const p of entry.probes.slice(0, PROBES_PER_REPO)) {
      const other = await fetchBlobText(fullName, p.blobSha);
      if (other && lineOverlap(p.content, other) >= NEAR_COPY_OVERLAP) nearCopyProbes += 1;
    }

    const level = classifyOverlap({ identicalFiles, comparedFiles: sourceFiles.length, nearCopyProbes });
    if (!level || level === "low") continue;

    if (candidateSince && meta.created_at > candidateSince) {
      copiedByOthers.push({ repoName: repo.name, matchedRepoFullName: fullName, identicalFiles });
      continue;
    }
    matches.push({
      repoName: repo.name,
      matchedRepoFullName: fullName,
      matchedRepoUrl: meta.html_url,
      level,
      identicalFiles,
      comparedFiles: sourceFiles.length,
      nearCopyProbes,
      matchedRepoCreatedAt: meta.created_at,
      matchedRepoStars: meta.stargazers_count,
      explanations: EXPLANATIONS[level],
    });
  }
  return { matches, copiedByOthers };
}

/**
 * Bounded by repo count and a wall-clock deadline so it can never stall a
 * scan. Needs a GitHub token (code search is authenticated-only); without
 * one it reports "unavailable" honestly instead of "no matches".
 */
export async function runOriginalityCheck(username: string, repos: FullRepoAnalysis[], deadline: number): Promise<OriginalityReport> {
  const targets = selectOriginalityTargets(repos);
  const base: OriginalityReport = { status: "unavailable", eligibleRepos: targets.length, checkedRepos: 0, matches: [], copiedByOthers: [], ranAt: new Date().toISOString() };
  if (!hasGithubToken()) return base;

  const report: OriginalityReport = { ...base, status: "checked" };
  for (const repo of targets.slice(0, ORIGINALITY_MAX_REPOS)) {
    if (Date.now() > deadline) break;
    try {
      const result = await checkOneRepo(username, repo, deadline);
      report.matches.push(...result.matches);
      report.copiedByOthers.push(...result.copiedByOthers);
      report.checkedRepos += 1;
    } catch {
      // One repo failing never fails the check -- it just isn't counted as checked.
    }
  }
  return report;
}
