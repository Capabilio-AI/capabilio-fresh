import type { FullRepoAnalysis } from "./github-scan";

export type SimilarityLevel = "low" | "moderate" | "high";

export interface SimilarityMatch {
  matchedRepoFullName: string;
  matchedRepoUrl: string;
  similarityLevel: SimilarityLevel;
  affectedArea: string | null;
  possibleExplanations: string[];
}

const POSSIBLE_EXPLANATIONS: Record<SimilarityLevel, string[]> = {
  low: ["Coincidental naming — a common project name shared by many unrelated repositories"],
  moderate: ["Legitimate fork or reuse of a public template", "Adapted implementation of a common project pattern", "Coincidental structural similarity"],
  high: ["Legitimate fork or open-source reuse", "Adapted implementation building on a public project", "Copied implementation — review recommended"],
};

// Generic project names produce frequent, low-value name collisions —
// suppressed from ever reaching "moderate" on name-match alone, so this
// stays a narrow, conservative signal rather than a noisy one.
const GENERIC_REPO_NAMES = new Set([
  "todo-app",
  "todo",
  "portfolio",
  "portfolio-website",
  "weather-app",
  "blog",
  "chat-app",
  "ecommerce",
  "e-commerce",
  "landing-page",
  "personal-website",
  "clone",
]);

export interface SearchResultRepo {
  fullName: string;
  htmlUrl: string;
  language: string | null;
}

/**
 * Pure classifier — separated from the network call so it's directly
 * unit-testable. MVP method only: an exact repository-name collision with
 * a different owner, refined by whether the name is generic (common, low
 * signal value) and whether the primary language also matches (a real,
 * cheap corroborating signal). Deliberately narrow: this will under-detect
 * real similarity rather than over-claim it — false "review recommended"
 * flags are the worse failure mode for a signal that reaches a human
 * decision. A stronger method (dependency-manifest diffing, structural
 * fingerprinting, embeddings) is future work behind this same interface;
 * "high" is never reached by this MVP implementation alone.
 */
export function classifyNameCollision(candidateRepo: FullRepoAnalysis, matched: SearchResultRepo): SimilarityMatch | null {
  const isGenericName = GENERIC_REPO_NAMES.has(candidateRepo.name.toLowerCase());
  const languageMatches = Boolean(candidateRepo.primaryLanguage) && candidateRepo.primaryLanguage === matched.language;

  if (isGenericName && !languageMatches) return null; // too weak to be worth surfacing at all

  const level: SimilarityLevel = !isGenericName && languageMatches ? "moderate" : "low";

  return {
    matchedRepoFullName: matched.fullName,
    matchedRepoUrl: matched.htmlUrl,
    similarityLevel: level,
    affectedArea: languageMatches ? candidateRepo.primaryLanguage : null,
    possibleExplanations: POSSIBLE_EXPLANATIONS[level],
  };
}

export function eligibleForSimilarityCheck(repo: FullRepoAnalysis): boolean {
  return !repo.isFork && !repo.isArchived && repo.scanStatus !== "failed";
}
