import { fetchWithBackoff } from "./github-scan";

const GITHUB_API = "https://api.github.com";
const MAX_FULL_HISTORY_COMMITS = 100; // one page; above this the "first" commit isn't in hand, so dump checks are skipped rather than guessed
const BULK_FIRST_COMMIT_FILES = 40;
const BULK_MAX_TOTAL_COMMITS = 5;
const PREDATES_REPO_DAYS = 7;
const SINGLE_DAY_MIN_COMMITS = 8;
const MESSAGE_MIN_COMMITS = 10;
const GENERIC_MESSAGE = /^(update|updates|fix|fixes|change|changes|commit|initial commit|first commit|add files?|files?|wip|test|tests|\.+|asdf+|done|final|code)\.?$/i;

export type ForensicSignal = { signal: string; detail: string; tone: "positive" | "review" };

export type CommitSample = { message: string; authoredAt: string };

export type ForensicsInput = {
  repoCreatedAt: string | null;
  /** Total commits by this profile in the repo. */
  totalCommits: number;
  /** Up to 100 of this profile's commits, newest first. */
  commits: CommitSample[];
  /** Size of the oldest commit; only meaningful when the full history was fetched. */
  firstCommit: { fileCount: number; additions: number } | null;
};

const day = (iso: string) => iso.slice(0, 10);
const daysBetween = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
const firstLine = (message: string) => message.split("\n")[0].trim();

/**
 * Pure. Looks only at how the history is shaped -- never at intent. Author
 * dates can be set by the committer, so none of this is proof; every review
 * signal names the ordinary explanations alongside it.
 */
export function analyzeCommitHistory(input: ForensicsInput): ForensicSignal[] {
  const { commits, totalCommits, firstCommit, repoCreatedAt } = input;
  if (commits.length === 0) return [];
  const signals: ForensicSignal[] = [];
  const fullHistory = totalCommits <= MAX_FULL_HISTORY_COMMITS;
  const dates = commits.map((c) => c.authoredAt);
  const oldest = dates.reduce((a, b) => (a < b ? a : b));
  const newest = dates.reduce((a, b) => (a > b ? a : b));
  const activeDays = new Set(dates.map(day)).size;
  const messages = commits.map((c) => firstLine(c.message));
  const genericShare = messages.filter((m) => GENERIC_MESSAGE.test(m)).length / messages.length;

  if (fullHistory && firstCommit && firstCommit.fileCount >= BULK_FIRST_COMMIT_FILES && totalCommits <= BULK_MAX_TOTAL_COMMITS) {
    signals.push({
      tone: "review",
      signal: "Project arrived as a bulk upload",
      detail: `The first commit adds ${firstCommit.fileCount} files (+${firstCommit.additions.toLocaleString("en-IN")} lines) and the repository has ${totalCommits} commit${totalCommits === 1 ? "" : "s"} by this profile. Common when a project is moved from local files or another host.`,
    });
  }

  if (fullHistory && repoCreatedAt && daysBetween(oldest, repoCreatedAt) >= PREDATES_REPO_DAYS && oldest < repoCreatedAt) {
    signals.push({
      tone: "review",
      signal: "Commit history predates the repository",
      detail: `The earliest commit is dated ${Math.round(daysBetween(oldest, repoCreatedAt))} days before the GitHub repository was created, so the history was pushed from elsewhere. Normal after a migration or rebase.`,
    });
  }

  if (totalCommits >= SINGLE_DAY_MIN_COMMITS && activeDays === 1) {
    signals.push({ tone: "review", signal: "All commits on a single day", detail: `${totalCommits} commits fall on ${day(newest)}.` });
  }

  if (commits.length >= MESSAGE_MIN_COMMITS && genericShare >= 0.6) {
    signals.push({
      tone: "review",
      signal: "Mostly generic commit messages",
      detail: `${Math.round(genericShare * 100)}% of messages are one-word notes such as "update" or "fix", which makes the work harder to follow.`,
    });
  }

  if (commits.length >= 15 && daysBetween(oldest, newest) >= 14 && activeDays >= 4) {
    signals.push({
      tone: "positive",
      signal: "Built up incrementally",
      detail: `${totalCommits} commits across ${activeDays} separate days over ${Math.round(daysBetween(oldest, newest))} days.`,
    });
  }

  const lengths = messages.map((m) => m.length).sort((a, b) => a - b);
  const medianLength = lengths[Math.floor(lengths.length / 2)] ?? 0;
  if (commits.length >= MESSAGE_MIN_COMMITS && medianLength >= 25 && genericShare <= 0.25) {
    signals.push({ tone: "positive", signal: "Descriptive commit messages", detail: `Typical message is ${medianLength} characters and explains the change.` });
  }

  return signals;
}

async function fetchAuthorCommitSamples(owner: string, repo: string, username: string): Promise<{ commits: CommitSample[]; shas: string[] }> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&per_page=${MAX_FULL_HISTORY_COMMITS}`);
  if (!res.ok) return { commits: [], shas: [] };
  const body = (await res.json()) as { sha: string; commit: { message: string; author?: { date?: string } } }[];
  const rows = body.filter((c) => c.commit.author?.date);
  return {
    commits: rows.map((c) => ({ message: c.commit.message, authoredAt: c.commit.author?.date as string })),
    shas: rows.map((c) => c.sha),
  };
}

async function fetchCommitSize(owner: string, repo: string, sha: string): Promise<{ fileCount: number; additions: number } | null> {
  const res = await fetchWithBackoff(`${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { stats?: { additions: number }; files?: unknown[] };
  return { fileCount: body.files?.length ?? 0, additions: body.stats?.additions ?? 0 };
}

/** Never throws -- forensics is an add-on to a scan that has already succeeded. */
export async function runCommitForensics(args: { owner: string; repo: string; username: string; repoCreatedAt: string | null; totalCommits: number }): Promise<ForensicSignal[]> {
  try {
    const { commits, shas } = await fetchAuthorCommitSamples(args.owner, args.repo, args.username);
    const fullHistory = args.totalCommits <= MAX_FULL_HISTORY_COMMITS && shas.length > 0;
    const firstCommit = fullHistory ? await fetchCommitSize(args.owner, args.repo, shas[shas.length - 1]) : null;
    return analyzeCommitHistory({ repoCreatedAt: args.repoCreatedAt, totalCommits: args.totalCommits, commits, firstCommit });
  } catch {
    return [];
  }
}
