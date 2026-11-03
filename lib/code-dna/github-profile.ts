import { authHeaders, hasGithubToken } from "./github-scan";

// One GraphQL call gives what the REST API cannot: a real year of
// contribution days, reviews, and pull requests to other people's
// repositories. GraphQL needs a token, so without GITHUB_TOKEN this returns
// null and the scan simply has no activity section -- never a fabricated one.
const GRAPHQL_URL = "https://api.github.com/graphql";
const DAY_MS = 86_400_000;

export type AccountFacts = {
  login: string;
  name: string | null;
  avatarUrl: string;
  createdAt: string;
  followers: number;
  following: number;
  publicRepos: number;
  company: string | null;
  location: string | null;
};

export type ActivitySummary = {
  windowFrom: string;
  windowTo: string;
  totalContributions: number;
  commits: number;
  pullRequests: number;
  reviews: number;
  issues: number;
  /** Contributions GitHub counts but hides (private repositories) -- shown as a count only. */
  privateContributions: number;
  activeDays: number;
  activeWeeks: number;
  longestStreak: number;
  currentStreak: number;
  last90DaysContributions: number;
  /** Daily contribution counts, oldest -> newest. GitHub starts the grid on a Sunday. */
  calendar: number[];
  /** Date (YYYY-MM-DD) of calendar[0], so the heatmap can align weekdays. */
  calendarStart: string;
  /** Pull requests this profile sent to repositories owned by someone else. */
  externalPullRequests: { opened: number; merged: number; repositories: number };
};

type CalendarDay = { date: string; contributionCount: number };

/** Pure. Streaks tolerate an empty "today": a streak is still alive if yesterday had activity. */
export function summarizeCalendar(counts: number[]): Pick<ActivitySummary, "activeDays" | "activeWeeks" | "longestStreak" | "currentStreak" | "last90DaysContributions"> {
  let activeDays = 0;
  let longestStreak = 0;
  let run = 0;
  for (const c of counts) {
    if (c > 0) {
      activeDays += 1;
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  let end = counts.length - 1;
  if (end >= 0 && counts[end] === 0) end -= 1;
  let currentStreak = 0;
  for (let i = end; i >= 0 && counts[i] > 0; i--) currentStreak += 1;

  let activeWeeks = 0;
  for (let start = 0; start < counts.length; start += 7) {
    if (counts.slice(start, start + 7).some((c) => c > 0)) activeWeeks += 1;
  }

  const last90DaysContributions = counts.slice(-90).reduce((sum, c) => sum + c, 0);
  return { activeDays, activeWeeks, longestStreak, currentStreak, last90DaysContributions };
}

const PROFILE_QUERY = `
query($login: String!) {
  user(login: $login) {
    login name avatarUrl createdAt company location
    followers { totalCount }
    following { totalCount }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
    contributionsCollection {
      startedAt endedAt
      totalCommitContributions totalPullRequestContributions
      totalPullRequestReviewContributions totalIssueContributions
      restrictedContributionsCount
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
      pullRequestContributionsByRepository(maxRepositories: 25) {
        repository { owner { login } }
        contributions(first: 100) { nodes { pullRequest { merged } } }
      }
    }
  }
}`;

interface GraphqlUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  createdAt: string;
  company: string | null;
  location: string | null;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: { totalCount: number };
  contributionsCollection: {
    startedAt: string;
    endedAt: string;
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalIssueContributions: number;
    restrictedContributionsCount: number;
    contributionCalendar: { weeks: { contributionDays: CalendarDay[] }[] };
    pullRequestContributionsByRepository: {
      repository: { owner: { login: string } };
      contributions: { nodes: { pullRequest: { merged: boolean } }[] };
    }[];
  };
}

/** Pure -- maps the GraphQL payload to our stored shapes. */
export function buildProfileFromGraphql(user: GraphqlUser): { account: AccountFacts; activity: ActivitySummary } {
  const c = user.contributionsCollection;
  const days = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const calendar = days.map((d) => d.contributionCount);

  const external = c.pullRequestContributionsByRepository.filter((r) => r.repository.owner.login.toLowerCase() !== user.login.toLowerCase());
  const externalNodes = external.flatMap((r) => r.contributions.nodes);

  return {
    account: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      publicRepos: user.repositories.totalCount,
      company: user.company,
      location: user.location,
    },
    activity: {
      windowFrom: c.startedAt,
      windowTo: c.endedAt,
      totalContributions: calendar.reduce((sum, n) => sum + n, 0),
      commits: c.totalCommitContributions,
      pullRequests: c.totalPullRequestContributions,
      reviews: c.totalPullRequestReviewContributions,
      issues: c.totalIssueContributions,
      privateContributions: c.restrictedContributionsCount,
      ...summarizeCalendar(calendar),
      calendar,
      calendarStart: days[0]?.date ?? c.startedAt.slice(0, 10),
      externalPullRequests: {
        opened: externalNodes.length,
        merged: externalNodes.filter((n) => n.pullRequest.merged).length,
        repositories: external.length,
      },
    },
  };
}

/** Never throws -- a missing token, a missing user, or a GitHub hiccup all return null. */
export async function fetchGithubActivity(username: string): Promise<{ account: AccountFacts; activity: ActivitySummary } | null> {
  if (!hasGithubToken()) return null;
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ query: PROFILE_QUERY, variables: { login: username } }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { user: GraphqlUser | null } };
    return body.data?.user ? buildProfileFromGraphql(body.data.user) : null;
  } catch {
    return null;
  }
}

export function accountAgeYears(createdAt: string, now: number = Date.now()): number {
  return Math.max(0, (now - new Date(createdAt).getTime()) / (365 * DAY_MS));
}
