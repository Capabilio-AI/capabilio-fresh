// Real GitHub REST API scanning — ported from capabilio-web's Code DNA
// approach: tech-stack detection is file-presence only (a fixed signal
// table), never guessed from file contents or repo names. No OAuth: an
// optional GITHUB_TOKEN env var only raises the (otherwise public,
// unauthenticated) rate limit — never required.

const GITHUB_API = "https://api.github.com";
const MAX_REPOS_TO_ANALYZE = 6;
const COMMIT_SAMPLE_SIZE = 5;

function authHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface GithubProfile {
  login: string;
  bio: string | null;
  publicRepos: number;
  htmlUrl: string;
}

/**
 * Accepts a bare username or a pasted GitHub profile/repo URL and extracts
 * just the username — pasting the URL from the address bar instead of
 * typing the username is a common, understandable mistake, not something
 * that should hard-fail with "not a valid GitHub username."
 */
export function normalizeGithubUsername(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i);
  if (urlMatch) return urlMatch[1];
  return trimmed.replace(/^@/, "");
}

export async function fetchGithubProfile(username: string): Promise<GithubProfile | null> {
  const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    login: data.login as string,
    bio: (data.bio as string | null) ?? null,
    publicRepos: (data.public_repos as number) ?? 0,
    htmlUrl: data.html_url as string,
  };
}

/** Ownership verification: the student adds this code to their public GitHub bio temporarily. */
export async function bioContainsCode(username: string, code: string): Promise<boolean> {
  const profile = await fetchGithubProfile(username);
  return Boolean(profile?.bio?.includes(code));
}

// File-presence only — never inferred from repo name, description, or file contents.
const TECH_SIGNALS: Record<string, string> = {
  "package.json": "Node.js",
  "tsconfig.json": "TypeScript",
  "next.config.js": "Next.js",
  "next.config.ts": "Next.js",
  "angular.json": "Angular",
  "requirements.txt": "Python",
  "pyproject.toml": "Python",
  Pipfile: "Python",
  "go.mod": "Go",
  "Cargo.toml": "Rust",
  "pom.xml": "Java",
  "build.gradle": "Java",
  Gemfile: "Ruby",
  "composer.json": "PHP",
  Dockerfile: "Docker",
  ".github": "CI/CD (GitHub Actions)",
  ".gitlab-ci.yml": "CI/CD (GitLab)",
};

/** Pure — testable without hitting the network. */
export function detectTechSignals(rootEntryNames: string[]): string[] {
  const found = new Set<string>();
  for (const name of rootEntryNames) {
    const tech = TECH_SIGNALS[name];
    if (tech) found.add(tech);
  }
  return [...found];
}

/** Pure — testable without hitting the network. */
export function detectTestDir(rootEntryNames: string[]): boolean {
  return rootEntryNames.some((n) => /^(tests?|__tests__|spec)$/i.test(n));
}

/** Pure — testable without hitting the network. */
export function detectReadme(rootEntryNames: string[]): boolean {
  return rootEntryNames.some((n) => /^readme(\.md|\.rst|\.txt)?$/i.test(n));
}

export interface RepoAnalysis {
  name: string;
  htmlUrl: string;
  isFork: boolean;
  stars: number;
  updatedAt: string;
  techSignals: string[];
  hasReadme: boolean;
  hasTests: boolean;
  /** 0-1 share of a recent-commit sample authored by the profile owner; null for forks or when commit history isn't readable. */
  authorCommitShare: number | null;
}

export interface GithubScanResult {
  username: string;
  publicRepos: number;
  repositoriesAnalyzed: number;
  repos: RepoAnalysis[];
  pullRequestsOpened: number;
  pullRequestsMerged: number;
}

interface GithubRepoListItem {
  name: string;
  html_url: string;
  fork: boolean;
  stargazers_count: number;
  updated_at: string;
}

async function listTopRepos(username: string): Promise<GithubRepoListItem[]> {
  const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`GitHub repo list failed: ${res.status}`);
  const repos = (await res.json()) as GithubRepoListItem[];
  return [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, MAX_REPOS_TO_ANALYZE);
}

async function listRootContents(username: string, repo: string): Promise<string[]> {
  const res = await fetch(`${GITHUB_API}/repos/${username}/${repo}/contents/`, { headers: authHeaders() });
  if (!res.ok) return [];
  const items = (await res.json()) as { name: string }[];
  return items.map((i) => i.name);
}

async function analyzeCommitAuthorship(username: string, repo: string): Promise<number | null> {
  const res = await fetch(`${GITHUB_API}/repos/${username}/${repo}/commits?per_page=${COMMIT_SAMPLE_SIZE}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const commits = (await res.json()) as { author: { login: string } | null }[];
  if (commits.length === 0) return null;
  const byOwner = commits.filter((c) => c.author?.login?.toLowerCase() === username.toLowerCase()).length;
  return byOwner / commits.length;
}

async function analyzeRepo(username: string, repo: GithubRepoListItem): Promise<RepoAnalysis> {
  const rootNames = await listRootContents(username, repo.name);
  const authorCommitShare = repo.fork ? null : await analyzeCommitAuthorship(username, repo.name);
  return {
    name: repo.name,
    htmlUrl: repo.html_url,
    isFork: repo.fork,
    stars: repo.stargazers_count,
    updatedAt: repo.updated_at,
    techSignals: detectTechSignals(rootNames),
    hasReadme: detectReadme(rootNames),
    hasTests: detectTestDir(rootNames),
    authorCommitShare,
  };
}

async function countPullRequests(username: string): Promise<{ opened: number; merged: number }> {
  const q = (extra: string) => encodeURIComponent(`author:${username} type:pr ${extra}`);
  const [openedRes, mergedRes] = await Promise.all([
    fetch(`${GITHUB_API}/search/issues?q=${q("")}`, { headers: authHeaders() }),
    fetch(`${GITHUB_API}/search/issues?q=${q("is:merged")}`, { headers: authHeaders() }),
  ]);
  const opened = openedRes.ok ? ((await openedRes.json()).total_count ?? 0) : 0;
  const merged = mergedRes.ok ? ((await mergedRes.json()).total_count ?? 0) : 0;
  return { opened, merged };
}

export async function scanGithubProfile(username: string): Promise<GithubScanResult> {
  const [profile, topRepos, prStats] = await Promise.all([
    fetchGithubProfile(username),
    listTopRepos(username),
    countPullRequests(username),
  ]);
  if (!profile) throw new Error("GitHub profile not found");

  const repos = await Promise.all(topRepos.map((r) => analyzeRepo(username, r)));

  return {
    username: profile.login,
    publicRepos: profile.publicRepos,
    repositoriesAnalyzed: repos.length,
    repos,
    pullRequestsOpened: prStats.opened,
    pullRequestsMerged: prStats.merged,
  };
}
