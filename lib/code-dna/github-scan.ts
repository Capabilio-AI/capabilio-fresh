// Real GitHub REST API scanning — ported from capabilio-web's Code DNA
// approach: tech-stack detection is file-presence only (a fixed signal
// table), never guessed from file contents or repo names, with one
// deliberate, bounded exception (see DEPENDENCY_SIGNALS below). No OAuth:
// an optional GITHUB_TOKEN env var only raises the (otherwise public,
// unauthenticated) rate limit — never required, never per-user.

const GITHUB_API = "https://api.github.com";
// Not a "top-N significant repos" curation cutoff — every discovered,
// non-empty repo is analyzed. This is a rate-limit/cost safety valve only,
// for the rare account with an implausible repo count; selectSignificantRepositories
// still ranks so the valve (if it ever triggers) drops the least-significant
// repos first, not an arbitrary slice. Coverage is always surfaced
// (repositoriesConsidered vs repositories.length), never silently truncated.
// ~7 GitHub API calls per repo; 60 repos * 7 ≈ 420 calls, well inside the
// 5000/hr authenticated rate limit for a single scan.
export const MAX_REPOS_TO_ANALYZE = 60;
const COMMIT_SAMPLE_SIZE = 5;
const COMMIT_AGGREGATE_PAGE_SIZE = 100;
const MAX_REPO_LIST_PAGES = 20; // caps at 2000 repos discovered before ranking/selection -- a documented safety valve, not silent truncation; repositoriesConsidered always reflects what was actually found
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

// A type alias (not `interface`) so this structurally satisfies Supabase's
// Json type when persisted to a jsonb column — interfaces don't get the
// implicit index signature that makes an object type Json-assignable.
export type ContributorSummary = {
  login: string;
  contributions: number;
};

const TOP_CONTRIBUTORS_LIMIT = 10;

/** GitHub's contributors list is already sorted by contribution count, so one request (per_page=10) gets both the top contributors and, via the Link header, the exact total count — no extra call needed. */
async function fetchContributors(owner: string, repo: string): Promise<{ count: number | null; top: ContributorSummary[] }> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=${TOP_CONTRIBUTORS_LIMIT}&anon=true`);
  if (!res.ok) return { count: null, top: [] };
  const body = (await res.json()) as { login?: string; contributions: number; type: string }[];
  const top = body.filter((c) => c.type !== "Anonymous" && c.login).map((c) => ({ login: c.login as string, contributions: c.contributions }));
  const lastPage = lastPageFromLinkHeader(res.headers.get("link"));
  const count = lastPage ?? body.length;
  return { count, top };
}

export function languagePercentages(bytesByLanguage: Record<string, number>): { name: string; percentage: number }[] {
  const total = Object.values(bytesByLanguage).reduce((sum, b) => sum + b, 0);
  if (total === 0) return [];
  return Object.entries(bytesByLanguage)
    .map(([name, bytes]) => ({ name, percentage: Math.round((bytes / total) * 1000) / 10 }))
    .sort((a, b) => b.percentage - a.percentage);
}

async function fetchLanguages(owner: string, repo: string): Promise<{ name: string; percentage: number }[]> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}/languages`);
  if (!res.ok) return [];
  const body = (await res.json()) as Record<string, number>;
  return languagePercentages(body);
}

export interface FullRepoAnalysis {
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  description: string | null;
  isFork: boolean;
  forkSourceFullName: string | null;
  forkSourceUrl: string | null;
  primaryLanguage: string | null;
  languages: { name: string; percentage: number }[];
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
  /** 0-1 share of a recent commit sample authored by the profile owner; null when commit history isn't readable. */
  authorshipSample: number | null;
  techSignals: string[];
  hasTests: boolean;
  hasCi: boolean;
  hasReadme: boolean;
  hasDependencies: boolean;
  hasDatabaseSignal: boolean;
  hasAuthSignal: boolean;
  contributorsCount: number | null;
  topContributors: ContributorSummary[];
  scanStatus: "ok" | "partial" | "failed";
  scanError: string | null;
}

/**
 * Full per-repo scan for one already-selected repo. Never throws — a
 * single repo's failure is captured as scanStatus:'failed'/'partial' so it
 * can never take down the whole scan (the route continues past it).
 */
export async function scanOneRepository(username: string, repo: GithubRepoListItem): Promise<FullRepoAnalysis> {
  const [repoOwner] = repo.full_name.split("/");
  const base: FullRepoAnalysis = {
    name: repo.name,
    fullName: repo.full_name,
    owner: repoOwner,
    htmlUrl: repo.html_url,
    description: repo.description,
    isFork: repo.fork,
    forkSourceFullName: null,
    forkSourceUrl: null,
    primaryLanguage: repo.language,
    languages: [],
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
    topContributors: [],
    scanStatus: "ok",
    scanError: null,
  };

  try {
    const owner = repoOwner;
    // Commits are aggregated for every repo, forks included: a candidate
    // can make substantial original commits on their own fork (e.g.
    // building on a starter template), and zeroing that out contradicted
    // the "candidate activity after fork" requirement — the fork itself is
    // still disclosed via forkSourceFullName, never hidden.
    const [rootNames, detail, commits, prs, contributors, languages] = await Promise.all([
      listRootContents(owner, repo.name),
      fetchRepoDetail(owner, repo.name, repo.fork),
      aggregateAuthorCommits(owner, repo.name, username),
      aggregateAuthorPullRequests(repo.full_name, username),
      fetchContributors(owner, repo.name),
      fetchLanguages(owner, repo.name),
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
      languages,
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
      contributorsCount: contributors.count,
      topContributors: contributors.top,
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

/** A stored github_repositories row, shaped for the derivation modules — same fields scanOneRepository produces, read back from the database instead of a live scan. */
export interface StoredRepositoryRow {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  is_fork: boolean;
  fork_source_full_name: string | null;
  fork_source_url: string | null;
  primary_language: string | null;
  languages: unknown;
  topics: string[];
  license: string | null;
  stars: number;
  forks_count: number;
  is_archived: boolean;
  size_kb: number;
  repo_created_at: string | null;
  repo_updated_at: string | null;
  candidate_commit_count: number;
  candidate_pr_count: number;
  candidate_pr_merged_count: number;
  first_candidate_commit_at: string | null;
  last_candidate_commit_at: string | null;
  tech_signals: string[];
  has_tests: boolean;
  has_ci: boolean;
  has_readme: boolean;
  has_dependencies: boolean;
  has_database_signal: boolean;
  has_auth_signal: boolean;
  contributors_count: number | null;
  top_contributors: unknown;
  scan_status: string;
  scan_error: string | null;
}

/** Converts a stored row back into the shape the derivation modules and the UI expect — the one place that mapping happens, instead of duplicated per route/page. */
export function rowToFullRepoAnalysis(r: StoredRepositoryRow): FullRepoAnalysis {
  return {
    name: r.name,
    fullName: r.full_name,
    owner: r.full_name.split("/")[0],
    htmlUrl: r.html_url,
    description: r.description,
    isFork: r.is_fork,
    forkSourceFullName: r.fork_source_full_name,
    forkSourceUrl: r.fork_source_url,
    primaryLanguage: r.primary_language,
    languages: (r.languages ?? []) as { name: string; percentage: number }[],
    topics: r.topics,
    license: r.license,
    stars: r.stars,
    forksCount: r.forks_count,
    isArchived: r.is_archived,
    sizeKb: r.size_kb,
    repoCreatedAt: r.repo_created_at,
    repoUpdatedAt: r.repo_updated_at,
    candidateCommitCount: r.candidate_commit_count,
    candidatePrCount: r.candidate_pr_count,
    candidatePrMergedCount: r.candidate_pr_merged_count,
    firstCandidateCommitAt: r.first_candidate_commit_at,
    lastCandidateCommitAt: r.last_candidate_commit_at,
    authorshipSample: null,
    techSignals: r.tech_signals,
    hasTests: r.has_tests,
    hasCi: r.has_ci,
    hasReadme: r.has_readme,
    hasDependencies: r.has_dependencies,
    hasDatabaseSignal: r.has_database_signal,
    hasAuthSignal: r.has_auth_signal,
    contributorsCount: r.contributors_count,
    topContributors: (r.top_contributors ?? []) as ContributorSummary[],
    scanStatus: r.scan_status as "ok" | "partial" | "failed",
    scanError: r.scan_error,
  };
}

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
