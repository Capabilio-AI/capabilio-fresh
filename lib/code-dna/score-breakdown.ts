import type { FullRepoAnalysis } from "./github-scan";
import { accountAgeYears, type AccountFacts, type ActivitySummary } from "./github-profile";
import type { ForensicSignal } from "./commit-forensics";
import type { OriginalityReport } from "./originality";

export type ScorePartKey = "activity" | "originality" | "collaboration" | "practice" | "consistency";

export type ScorePart = { key: ScorePartKey; label: string; score: number; weight: number; detail: string };

export type ScoreBreakdown = {
  overall: number;
  parts: ScorePart[];
  /** "repos-only" when no contribution calendar was available (no token / lookup failed). */
  basis: "full" | "repos-only";
};

export type ScoreInput = {
  repos: FullRepoAnalysis[];
  account: AccountFacts | null;
  activity: ActivitySummary | null;
  forensics: ForensicSignal[];
  originality: OriginalityReport | null;
  now?: number;
};

const WEIGHTS: Record<ScorePartKey, number> = { activity: 25, originality: 25, collaboration: 20, practice: 15, consistency: 15 };
const LABELS: Record<ScorePartKey, string> = {
  activity: "Activity",
  originality: "Originality",
  collaboration: "Collaboration",
  practice: "Engineering practice",
  consistency: "Consistency",
};
const HIGH_MATCH_PENALTY = 35;
const MODERATE_MATCH_PENALTY = 15;
const REVIEW_SIGNAL_PENALTY = 6;
const MAX_REVIEW_PENALTY = 24;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const ratio = (value: number, full: number) => Math.min(1, value / full);
const part = (key: ScorePartKey, score: number, detail: string): ScorePart => ({ key, label: LABELS[key], score: clamp(score), weight: WEIGHTS[key], detail });

function activityPart(repos: FullRepoAnalysis[], activity: ActivitySummary | null): ScorePart {
  if (activity) {
    const recent = activity.last90DaysContributions > 0 ? 1 : 0;
    const score = 100 * (0.45 * ratio(activity.totalContributions, 600) + 0.35 * ratio(activity.activeDays, 120) + 0.2 * recent);
    return part("activity", score, `${activity.totalContributions.toLocaleString("en-IN")} contributions on ${activity.activeDays} days in the last year.`);
  }
  const commits = repos.reduce((sum, r) => sum + r.candidateCommitCount, 0);
  return part("activity", 100 * ratio(commits, 200), `${commits} commits across the scanned repositories.`);
}

function originalityPart(repos: FullRepoAnalysis[], forensics: ForensicSignal[], originality: OriginalityReport | null): ScorePart {
  const ok = repos.filter((r) => r.scanStatus !== "failed");
  const withWork = ok.filter((r) => !r.isFork && r.candidateCommitCount > 0);
  if (ok.length === 0 || withWork.length === 0) return part("originality", 20, "No original, attributable repository work found yet.");

  const matches = originality?.matches ?? [];
  const high = matches.filter((m) => m.level === "high").length;
  const moderate = matches.filter((m) => m.level === "moderate").length;
  const reviewSignals = forensics.filter((f) => f.tone === "review").length;
  const penalty = high * HIGH_MATCH_PENALTY + moderate * MODERATE_MATCH_PENALTY + Math.min(MAX_REVIEW_PENALTY, reviewSignals * REVIEW_SIGNAL_PENALTY);
  const originalShare = withWork.length / ok.length;
  const score = 100 * originalShare - penalty;

  const notes = [`${withWork.length} of ${ok.length} repositories are original work.`];
  if (originality?.status === "checked") notes.push(`${originality.checkedRepos} checked against public code${matches.length ? `, ${matches.length} overlap${matches.length === 1 ? "" : "s"} to review` : ", no overlap found"}.`);
  return part("originality", score, notes.join(" "));
}

function collaborationPart(repos: FullRepoAnalysis[], activity: ActivitySummary | null): ScorePart {
  if (activity) {
    const ext = activity.externalPullRequests;
    const score = 100 * (0.5 * ratio(ext.merged, 5) + 0.3 * ratio(activity.reviews, 10) + 0.2 * ratio(ext.repositories, 3));
    return part("collaboration", score, `${ext.merged} pull request${ext.merged === 1 ? "" : "s"} merged into others' projects, ${activity.reviews} review${activity.reviews === 1 ? "" : "s"} given.`);
  }
  const merged = repos.reduce((sum, r) => sum + r.candidatePrMergedCount, 0);
  return part("collaboration", 100 * ratio(merged, 3), `${merged} merged pull request${merged === 1 ? "" : "s"} in the scanned repositories.`);
}

function practicePart(repos: FullRepoAnalysis[]): ScorePart {
  const sample = repos
    .filter((r) => !r.isFork && r.scanStatus !== "failed")
    .sort((a, b) => b.candidateCommitCount - a.candidateCommitCount)
    .slice(0, 5);
  if (sample.length === 0) return part("practice", 0, "No repositories to assess.");
  const perRepo = sample.map((r) => [r.hasTests, r.hasCi, r.hasReadme, r.hasDependencies].filter(Boolean).length / 4);
  const score = (perRepo.reduce((sum, v) => sum + v, 0) / perRepo.length) * 100;
  return part("practice", score, `Tests, CI, README and dependency management across ${sample.length} main repositor${sample.length === 1 ? "y" : "ies"}.`);
}

function consistencyPart(account: AccountFacts | null, activity: ActivitySummary | null, now: number): ScorePart {
  if (!activity) return part("consistency", 0, "Needs a contribution calendar to measure.");
  const years = account ? accountAgeYears(account.createdAt, now) : 0;
  const score = 100 * (0.6 * ratio(activity.activeWeeks, 52) + 0.25 * ratio(years, 3) + 0.15 * ratio(activity.longestStreak, 14));
  return part("consistency", score, `Active in ${activity.activeWeeks} of the last 52 weeks, longest streak ${activity.longestStreak} days${account ? `, account ${years.toFixed(1)} years old` : ""}.`);
}

/** Pure + deterministic. AI never touches this: every number traces to a counted fact. */
export function deriveScoreBreakdown(input: ScoreInput): ScoreBreakdown {
  const { repos, account, activity, forensics, originality, now = Date.now() } = input;
  const parts = [
    activityPart(repos, activity),
    originalityPart(repos, forensics, originality),
    collaborationPart(repos, activity),
    practicePart(repos),
    consistencyPart(account, activity, now),
  ];
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const overall = clamp(parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight);
  return { overall, parts, basis: activity ? "full" : "repos-only" };
}
