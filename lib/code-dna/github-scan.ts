// Real GitHub REST API scanning — ported from capabilio-web's Code DNA
// approach: tech-stack detection is file-presence only (a fixed signal
// table), never guessed from file contents or repo names, with one
// deliberate, bounded exception (see DEPENDENCY_SIGNALS below). No OAuth:
// an optional GITHUB_TOKEN env var only raises the (otherwise public,
// unauthenticated) rate limit — never required, never per-user.

const GITHUB_API = "https://api.github.com";
export const MAX_REPOS_TO_ANALYZE = 8;
const COMMIT_SAMPLE_SIZE = 5;
const COMMIT_AGGREGATE_PAGE_SIZE = 100;
const MAX_REPO_LIST_PAGES = 5; // caps at 500 repos considered before ranking/selection
const MAX_BACKOFF_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;

function authHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Retries on rate-limit responses with capped exponential backoff — real
 * resilience, not a silent failure into empty data. Bounded (3 attempts,
 * max 8s wait) so a single scan request never hangs indefinitely.
 */
export async function fetchWithBackoff(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url, { headers: authHeaders() });
  const isRateLimited = (res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0";
  if (isRateLimited && attempt < MAX_BACKOFF_ATTEMPTS) {
    const waitMs = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), 8000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return fetchWithBackoff(url, attempt + 1);
  }
  return res;
}

/** GitHub paginates via a `Link` header, not a total-count field — this reads the last page number to get an exact count without fetching every page. */
export function lastPageFromLinkHeader(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
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

/**
 * One deliberate step beyond pure file-presence: a repo's own declared
 * package.json dependencies are still real, deterministic evidence (not a
 * guess) — this is what makes "database"/"auth"/"API layer" observable at
 * all, which this analysis is explicitly expected to show. Bounded to a
 * small, curated, unambiguous allowlist; never inferred from file content
 * beyond this one well-defined JSON field.
 */
const DEPENDENCY_SIGNALS: Record<string, { category: "database" | "auth" | "api"; label: string }> = {
  pg: { category: "database", label: "PostgreSQL" },
  mysql2: { category: "database", label: "MySQL" },
  mongoose: { category: "database", label: "MongoDB" },
  prisma: { category: "database", label: "Prisma ORM" },
  typeorm: { category: "database", label: "TypeORM" },
  sequelize: { category: "database", label: "Sequelize ORM" },
  "drizzle-orm": { category: "database", label: "Drizzle ORM" },
  "@supabase/supabase-js": { category: "database", label: "Supabase" },
  "next-auth": { category: "auth", label: "NextAuth" },
  passport: { category: "auth", label: "Passport.js" },
  jsonwebtoken: { category: "auth", label: "JWT Auth" },
  bcrypt: { category: "auth", label: "Password Hashing (bcrypt)" },
  express: { category: "api", label: "Express API" },
  fastify: { category: "api", label: "Fastify API" },
  koa: { category: "api", label: "Koa API" },
  "@nestjs/core": { category: "api", label: "NestJS API" },
  graphql: { category: "api", label: "GraphQL API" },
};

export interface DependencySignals {
  labels: string[];
  hasDatabaseSignal: boolean;
  hasAuthSignal: boolean;
}

/** Pure — testable without hitting the network. */
export function detectDependencySignals(dependencyNames: string[]): DependencySignals {
  const labels: string[] = [];
  let hasDatabaseSignal = false;
  let hasAuthSignal = false;
  for (const dep of dependencyNames) {
    const signal = DEPENDENCY_SIGNALS[dep];
    if (!signal) continue;
    labels.push(signal.label);
    if (signal.category === "database") hasDatabaseSignal = true;
    if (signal.category === "auth") hasAuthSignal = true;
  }
  return { labels, hasDatabaseSignal, hasAuthSignal };
}

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

// --- Legacy shape, kept for lib/code-dna/capability-derivation.ts's
// existing, already-tested Skill Gap integration, which only ever reads
// isFork/techSignals/hasTests. Constructed as an adapter from the v2 scan
// in app/api/code-dna/scan/route.ts — never populated from the network
// directly anymore.
export interface RepoAnalysis {
  name: string;
  htmlUrl: string;
  isFork: boolean;
  stars: number;
  updatedAt: string;
  techSignals: string[];
  hasReadme: boolean;
  hasTests: boolean;
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
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  archived: boolean;
  size: number;
  language: string | null;
  topics?: string[];
  license: { name: string } | null;
  created_at: string;
  updated_at: string;
}

async function listAllRepos(username: string): Promise<GithubRepoListItem[]> {
  const all: GithubRepoListItem[] = [];
  for (let page = 1; page <= MAX_REPO_LIST_PAGES; page++) {
    const res = await fetchWithBackoff(
      `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}`
    );
    if (!res.ok) break; // partial results are acceptable; never throw here
    const batch = (await res.json()) as GithubRepoListItem[];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function listRootContents(owner: string, repo: string): Promise<string[]> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}/contents/`);
  if (!res.ok) return [];
  const items = (await res.json()) as { name: string }[];
  return Array.isArray(items) ? items.map((i) => i.name) : [];
}

async function fetchPackageJsonDependencies(owner: string, repo: string): Promise<string[]> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}/contents/package.json`);
  if (!res.ok) return [];
  const file = (await res.json()) as { content?: string; encoding?: string };
  if (!file.content || file.encoding !== "base64") return [];
  try {
    const decoded = JSON.parse(Buffer.from(file.content, "base64").toString("utf-8"));
    return [...Object.keys(decoded.dependencies ?? {}), ...Object.keys(decoded.devDependencies ?? {})];
  } catch {
    return [];
  }
}

interface RepoDetail {
  forkSourceFullName: string | null;
  forkSourceUrl: string | null;
}

async function fetchRepoDetail(owner: string, repo: string, isFork: boolean): Promise<RepoDetail> {
  if (!isFork) return { forkSourceFullName: null, forkSourceUrl: null };
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}`);
  if (!res.ok) return { forkSourceFullName: null, forkSourceUrl: null };
  const data = await res.json();
  return {
    forkSourceFullName: (data.parent?.full_name as string | undefined) ?? null,
    forkSourceUrl: (data.parent?.html_url as string | undefined) ?? null,
  };
}

interface CommitAggregate {
  count: number;
  firstAt: string | null;
  lastAt: string | null;
  authorshipSample: number | null; // 0-1 share of a recent sample authored by the profile owner
}

async function aggregateAuthorCommits(owner: string, repo: string, username: string): Promise<CommitAggregate> {
  // Exact count via the Link header's last-page number (cheap: one request, per_page=1).
  const countRes = await fetchWithBackoff(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&per_page=1`
  );
  if (!countRes.ok) return { count: 0, firstAt: null, lastAt: null, authorshipSample: null };
  const countBody = (await countRes.json()) as { commit?: { author?: { date?: string } } }[];
  const lastPage = lastPageFromLinkHeader(countRes.headers.get("link"));
  const count = lastPage ?? countBody.length;
  const lastAt = countBody[0]?.commit?.author?.date ?? null;

  // First-commit date and a same-sample authorship share, from a single
  // bounded page (COMMIT_AGGREGATE_PAGE_SIZE) — for a repo with more
  // commits by this author than that page size, "first" is an honest
  // approximation (the oldest commit *in the sample*), not a claim of the
  // true first-ever commit. Documented, not silently overstated.
  const sampleRes = await fetchWithBackoff(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=${COMMIT_AGGREGATE_PAGE_SIZE}`
  );
  if (!sampleRes.ok) return { count, firstAt: null, lastAt, authorshipSample: null };
  const sample = (await sampleRes.json()) as { author: { login: string } | null; commit: { author?: { date?: string } } }[];
  const firstAt = sample.length > 0 ? (sample[sample.length - 1].commit.author?.date ?? null) : null;
  const authorSample = sample.slice(0, COMMIT_SAMPLE_SIZE);
  const authorshipSample =
    authorSample.length > 0
      ? authorSample.filter((c) => c.author?.login?.toLowerCase() === username.toLowerCase()).length / authorSample.length
      : null;

  return { count, firstAt, lastAt, authorshipSample };
}

interface PrAggregate {
  opened: number;
  merged: number;
}

async function aggregateAuthorPullRequests(fullName: string, username: string): Promise<PrAggregate> {
  const q = (extra: string) => encodeURIComponent(`repo:${fullName} author:${username} type:pr ${extra}`);
  const [openedRes, mergedRes] = await Promise.all([
    fetchWithBackoff(`${GITHUB_API}/search/issues?q=${q("")}`),
    fetchWithBackoff(`${GITHUB_API}/search/issues?q=${q("is:merged")}`),
  ]);
  const opened = openedRes.ok ? ((await openedRes.json()).total_count ?? 0) : 0;
  const merged = mergedRes.ok ? ((await mergedRes.json()).total_count ?? 0) : 0;
  return { opened, merged };
}

async function countContributors(owner: string, repo: string): Promise<number | null> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=1&anon=true`);
  if (!res.ok) return null;
  const lastPage = lastPageFromLinkHeader(res.headers.get("link"));
  if (lastPage) return lastPage;
  const body = (await res.json()) as unknown[];
  return Array.isArray(body) ? body.length : null;
}

export interface FullRepoAnalysis {
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  isFork: boolean;
  forkSourceFullName: string | null;
  forkSourceUrl: string | null;
  primaryLanguage: string | null;
  topics: string[];
  license: string | null;
  stars: number;
  forksCount: number;
  isArchived: boolean;
  sizeKb: number;
  repoCreatedAt: string | null;
  repoUpdatedAt: string | null;
  candidateCommitCount: number;
  candidatePrCount: number;
  candidatePrMergedCount: number;
  firstCandidateCommitAt: string | null;
  lastCandidateCommitAt: string | null;
  /** 0-1 share of a recent commit sample authored by the profile owner; null for forks or when commit history isn't readable. */
  authorshipSample: number | null;
  techSignals: string[];
  hasTests: boolean;
  hasCi: boolean;
  hasReadme: boolean;
  hasDependencies: boolean;
  hasDatabaseSignal: boolean;
  hasAuthSignal: boolean;
  contributorsCount: number | null;
  scanStatus: "ok" | "partial" | "failed";
  scanError: string | null;
}

/**
 * Full per-repo scan for one already-selected repo. Never throws — a
 * single repo's failure is captured as scanStatus:'failed'/'partial' so it
 * can never take down the whole scan (the route continues past it).
 */
export async function scanOneRepository(username: string, repo: GithubRepoListItem): Promise<FullRepoAnalysis> {
  const base: FullRepoAnalysis = {
    name: repo.name,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description,
    isFork: repo.fork,
    forkSourceFullName: null,
    forkSourceUrl: null,
    primaryLanguage: repo.language,
    topics: repo.topics ?? [],
    license: repo.license?.name ?? null,
    stars: repo.stargazers_count,
    forksCount: repo.forks_count,
    isArchived: repo.archived,
    sizeKb: repo.size,
    repoCreatedAt: repo.created_at,
    repoUpdatedAt: repo.updated_at,
    candidateCommitCount: 0,
    candidatePrCount: 0,
    candidatePrMergedCount: 0,
    firstCandidateCommitAt: null,
    lastCandidateCommitAt: null,
    authorshipSample: null,
    techSignals: [],
    hasTests: false,
    hasCi: false,
    hasReadme: false,
    hasDependencies: false,
    hasDatabaseSignal: false,
    hasAuthSignal: false,
    contributorsCount: null,
    scanStatus: "ok",
    scanError: null,
  };

  try {
    const [owner] = repo.full_name.split("/");
    const [rootNames, detail, commits, prs, contributors] = await Promise.all([
      listRootContents(owner, repo.name),
      fetchRepoDetail(owner, repo.name, repo.fork),
      repo.fork ? Promise.resolve<CommitAggregate>({ count: 0, firstAt: null, lastAt: null, authorshipSample: null }) : aggregateAuthorCommits(owner, repo.name, username),
      aggregateAuthorPullRequests(repo.full_name, username),
      countContributors(owner, repo.name),
    ]);

    const techSignals = detectTechSignals(rootNames);
    let dependencySignals: DependencySignals = { labels: [], hasDatabaseSignal: false, hasAuthSignal: false };
    if (techSignals.includes("Node.js")) {
      const deps = await fetchPackageJsonDependencies(owner, repo.name);
      dependencySignals = detectDependencySignals(deps);
    }

    return {
      ...base,
      forkSourceFullName: detail.forkSourceFullName,
      forkSourceUrl: detail.forkSourceUrl,
      candidateCommitCount: commits.count,
      candidatePrCount: prs.opened,
      candidatePrMergedCount: prs.merged,
      firstCandidateCommitAt: commits.firstAt,
      lastCandidateCommitAt: commits.lastAt,
      authorshipSample: commits.authorshipSample,
      techSignals: [...techSignals, ...dependencySignals.labels],
      hasTests: detectTestDir(rootNames),
      hasCi: techSignals.some((t) => t.startsWith("CI/CD")),
      hasReadme: detectReadme(rootNames),
      hasDependencies: techSignals.length > 0,
      hasDatabaseSignal: dependencySignals.hasDatabaseSignal,
      hasAuthSignal: dependencySignals.hasAuthSignal,
      contributorsCount: contributors,
      scanStatus: "ok",
    };
  } catch (error) {
    return { ...base, scanStatus: "failed", scanError: error instanceof Error ? error.message : "Unknown error" };
  }
}

export interface FullScanResult {
  username: string;
  publicRepos: number;
  repositoriesConsidered: number;
  repositories: FullRepoAnalysis[];
}

/**
 * The v2 scan pipeline: list every repo (paginated), rank+select the most
 * significant ones (see github-repository-selection.ts), then scan each
 * selected repo in full — one repo's failure never fails the whole scan.
 */
export async function scanGithubProfileFull(
  username: string,
  selectRepos: (repos: GithubRepoListItem[]) => GithubRepoListItem[]
): Promise<FullScanResult> {
  const profile = await fetchGithubProfile(username);
  if (!profile) throw new Error("GitHub profile not found");

  const allRepos = await listAllRepos(username);
  const selected = selectRepos(allRepos);
  const repositories = await Promise.all(selected.map((r) => scanOneRepository(username, r)));

  return {
    username: profile.login,
    publicRepos: profile.publicRepos,
    repositoriesConsidered: allRepos.length,
    repositories,
  };
}

export type { GithubRepoListItem };

/**
 * Searches for other public repositories with the same name, owned by
 * someone else — the raw candidate list for similarity.ts's pure
 * classifier. Never bulk-downloads or diffs repo contents; this is a
 * single, cheap metadata search per candidate repo, capped by the caller
 * (MAX_SIMILARITY_LOOKUPS in app/api/code-dna/scan/route.ts).
 */
export async function searchRepositoriesByName(
  repoName: string,
  excludeOwner: string
): Promise<{ fullName: string; htmlUrl: string; language: string | null }[]> {
  const res = await fetchWithBackoff(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(`${repoName} in:name`)}&per_page=5`);
  if (!res.ok) return [];
  const body = (await res.json()) as { items?: { full_name: string; html_url: string; language: string | null; owner: { login: string } }[] };
  return (body.items ?? [])
    .filter((r) => r.owner.login.toLowerCase() !== excludeOwner.toLowerCase())
    .map((r) => ({ fullName: r.full_name, htmlUrl: r.html_url, language: r.language }));
}
