import type { FullRepoAnalysis } from "./github-scan";

export interface QualitativeSignal {
  signal: string;
  detail: string;
}

export interface AuthenticityReview {
  authenticitySignals: QualitativeSignal[];
  reviewSignals: QualitativeSignal[];
  /** "GitHub Evidence Confidence" — a secondary number, never the headline. Fully deterministic; no AI involvement. */
  evidenceConfidence: number;
}

const CONSISTENT_AUTHORSHIP_THRESHOLD = 0.6;
const LONGITUDINAL_HISTORY_DAYS = 90;
const SHORT_WINDOW_DAYS = 7;
const SHORT_WINDOW_MIN_COMMITS = 10;

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Splits what used to be one LLM-decided "authenticity_score" into two
 * separate, deterministic, neutrally-worded signal lists — per the
 * brief's exact taxonomy and trust-language rules. Never combined back
 * into a single "genuine" verdict. A fork-heavy portfolio, a low commit
 * count, or a short contribution window is presented as a review signal,
 * not an accusation — no intent is inferred.
 */
export function deriveAuthenticityAndReview(repos: FullRepoAnalysis[]): AuthenticityReview {
  const ok = repos.filter((r) => r.scanStatus !== "failed");
  const original = ok.filter((r) => !r.isFork);
  const withCommitEvidence = original.filter((r) => r.candidateCommitCount > 0);

  const authenticitySignals: QualitativeSignal[] = [];
  const reviewSignals: QualitativeSignal[] = [];

  // --- Authenticity signals ---
  const samples = original.map((r) => r.authorshipSample).filter((s): s is number => s !== null);
  const avgAuthorship = samples.length > 0 ? samples.reduce((s, v) => s + v, 0) / samples.length : null;
  if (avgAuthorship !== null && avgAuthorship >= CONSISTENT_AUTHORSHIP_THRESHOLD) {
    authenticitySignals.push({
      signal: "Consistent authorship signals",
      detail: `${Math.round(avgAuthorship * 100)}% of sampled commits across original repositories are attributed to this profile.`,
    });
  }

  const longitudinal = withCommitEvidence.find(
    (r) => r.firstCandidateCommitAt && r.lastCandidateCommitAt && daysBetween(r.firstCandidateCommitAt, r.lastCandidateCommitAt) >= LONGITUDINAL_HISTORY_DAYS
  );
  if (longitudinal) {
    authenticitySignals.push({
      signal: "Longitudinal contribution history",
      detail: `Commit activity spans ${Math.round(daysBetween(longitudinal.firstCandidateCommitAt as string, longitudinal.lastCandidateCommitAt as string))} days in ${longitudinal.name}.`,
    });
  }

  if (withCommitEvidence.length >= 2) {
    authenticitySignals.push({
      signal: "Activity across multiple repositories",
      detail: `Real commit evidence found in ${withCommitEvidence.length} separate repositories.`,
    });
  }

  // --- Review signals (neutral — fork/reuse/short history are not suspicious by themselves) ---
  if (ok.length > 0 && original.length / ok.length < 0.5) {
    reviewSignals.push({
      signal: "Fork-heavy portfolio",
      detail: `${ok.length - original.length} of ${ok.length} analyzed repositories are forks. Forks are shown transparently, not treated as evidence against the candidate.`,
    });
  }

  if (withCommitEvidence.length <= 1) {
    reviewSignals.push({
      signal: "Limited original history",
      detail: "Real, attributable commit evidence was found in one or zero original repositories in this scan.",
    });
  }

  const allDates = ok.flatMap((r) => [r.firstCandidateCommitAt, r.lastCandidateCommitAt]).filter((d): d is string => Boolean(d));
  const totalCommits = ok.reduce((sum, r) => sum + r.candidateCommitCount, 0);
  if (allDates.length >= 2 && totalCommits >= SHORT_WINDOW_MIN_COMMITS) {
    const span = daysBetween(allDates.reduce((a, b) => (a < b ? a : b)), allDates.reduce((a, b) => (a > b ? a : b)));
    if (span <= SHORT_WINDOW_DAYS) {
      reviewSignals.push({
        signal: "Contribution concentrated in a short period",
        detail: `${totalCommits} commits observed within a ${Math.round(span)}-day window.`,
      });
    }
  }

  // --- GitHub Evidence Confidence (secondary number, deterministic) ---
  const breadthScore = Math.min(1, original.length / 3) * 30;
  const authorshipScore = (avgAuthorship ?? 0) * 30;
  const practiceScore =
    ([ok.some((r) => r.hasTests), ok.some((r) => r.hasCi), ok.some((r) => r.hasReadme), ok.some((r) => r.candidatePrCount > 0), ok.some((r) => r.hasDependencies)].filter(Boolean).length / 5) * 20;
  const totalMerged = ok.reduce((sum, r) => sum + r.candidatePrMergedCount, 0);
  const collaborationScore = Math.min(1, totalMerged / 3) * 20;
  const evidenceConfidence = Math.round(breadthScore + authorshipScore + practiceScore + collaborationScore);

  return { authenticitySignals, reviewSignals, evidenceConfidence };
}
