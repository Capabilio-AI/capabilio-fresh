import type { GithubRepoListItem } from "./github-scan";

const RECENT_DAYS = 180;
const ACTIVE_YEAR_DAYS = 365;
const STAR_THRESHOLD = 10;

/**
 * Which of a candidate's repos are worth the API budget to fully scan.
 * Deliberately NOT stars-only — a heavily-starred fork or a popular repo
 * the candidate barely touched is weak evidence of their own engineering
 * work. Score = recency + real authorship (non-fork) + technology
 * diversity signal (repo not empty/archived-forever) + a small, capped
 * star nudge. Pure and unit-tested so this can never silently regress
 * back to stars-alone ranking.
 */
export function scoreRepository(repo: GithubRepoListItem): number {
  let score = 0;

  const daysSinceUpdate = (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate <= RECENT_DAYS) score += 3;
  else if (daysSinceUpdate <= ACTIVE_YEAR_DAYS) score += 1;

  if (!repo.fork) score += 2;
  if (!repo.archived) score += 1;
  if (repo.language) score += 1;

  // Capped — stars can nudge, never dominate.
  if (repo.stargazers_count > STAR_THRESHOLD) score += 1;

  return score;
}

/** Pure, deterministic selection — highest score first, ties broken by recency. Explicit cap on how many repos this app will ever fully scan in one pass. */
export function selectSignificantRepositories(repos: GithubRepoListItem[], limit: number): GithubRepoListItem[] {
  return [...repos]
    .sort((a, b) => scoreRepository(b) - scoreRepository(a) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit);
}
