import type { GithubScanResult, RepoAnalysis } from "./github-scan";
import { confidenceFor } from "@/lib/capability/confidence";

export type CapabilityCategory =
  | "Programming"
  | "Frontend Engineering"
  | "Backend Engineering"
  | "Testing"
  | "DevOps/Infrastructure"
  | "Debugging"
  | "Algorithms"
  | "Database Engineering"
  | "API Design"
  | "Security"
  | "System Design"
  | "Data Analysis"
  | "AI/ML";

/**
 * The full taxonomy. Only the first five ever get derived today — see
 * docs/code-dna-discovery.md for exactly why: no real, server-verified
 * evidence source exists in this codebase for the rest. Kept as a fixed
 * list (not inferred from whatever happens to be evidenced) so the UI can
 * show a stable, honest "not enough evidence yet" group rather than a
 * shrinking/growing set of unexplained categories.
 */
export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  "Programming",
  "Frontend Engineering",
  "Backend Engineering",
  "Testing",
  "DevOps/Infrastructure",
  "Debugging",
  "Algorithms",
  "Database Engineering",
  "API Design",
  "Security",
  "System Design",
  "Data Analysis",
  "AI/ML",
];

/** URL-safe slug for a category (some names contain "/", unsafe as a route segment). */
export function categorySlug(category: CapabilityCategory): string {
  return category.toLowerCase().replace(/\//g, "-").replace(/\s+/g, "-");
}

const SLUG_TO_CATEGORY = new Map(CAPABILITY_CATEGORIES.map((c) => [categorySlug(c), c]));

export function categoryFromSlug(slug: string): CapabilityCategory | null {
  return SLUG_TO_CATEGORY.get(slug) ?? null;
}

export type EvidenceContext = "github" | "arena";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface CapabilityDerivation {
  category: CapabilityCategory;
  score: number;
  confidence: ConfidenceLevel;
  evidenceCount: number;
  lastVerifiedAt: string;
  contexts: EvidenceContext[];
}

/** One completed Arena `programming_fundamentals` attempt — server-computed correctness, never client-supplied. */
export interface ArenaProgrammingEvidence {
  correctCount: number;
  answeredCount: number;
  completedAt: string;
}

// Evidence older than this no longer earns full ("high") confidence, even
// with plenty of data points — a real, deterministic staleness rule, not
// an AI judgment call.
const RECENCY_CAP_DAYS = 180;

// File-presence tech signals (lib/code-dna/github-scan.ts's TECH_SIGNALS)
// bucketed into the capability taxonomy. Deliberately conservative: only
// signals with an unambiguous category get mapped; nothing here is
// inferred from file contents or repo names.
const FRONTEND_TECH = new Set(["TypeScript", "Next.js", "Angular"]);
const BACKEND_TECH = new Set(["Node.js", "Python", "Go", "Rust", "Java", "Ruby", "PHP"]);
const DEVOPS_TECH = new Set(["Docker", "CI/CD (GitHub Actions)", "CI/CD (GitLab)"]);

/**
 * The single source of truth for "does this repo count as evidence of
 * category X" — shared by both the scoring above and the evidence list /
 * "why this capability" explanation on the detail page, so they can never
 * disagree about which repos justified a score.
 */
export const GITHUB_CATEGORY_MATCHERS: Partial<Record<CapabilityCategory, (repo: RepoAnalysis) => boolean>> = {
  Programming: (r) => r.techSignals.length > 0,
  "Frontend Engineering": (r) => r.techSignals.some((t) => FRONTEND_TECH.has(t)),
  "Backend Engineering": (r) => r.techSignals.some((t) => BACKEND_TECH.has(t)),
  Testing: (r) => r.hasTests,
  "DevOps/Infrastructure": (r) => r.techSignals.some((t) => DEVOPS_TECH.has(t)),
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function withRecencyCap(confidence: ConfidenceLevel, lastVerifiedAt: string): ConfidenceLevel {
  if (confidence === "high" && daysSince(lastVerifiedAt) > RECENCY_CAP_DAYS) return "medium";
  return confidence;
}

/** GitHub-sourced score: the share of analyzed original repos exhibiting real evidence of this category. */
function deriveFromRepoSignal(
  category: CapabilityCategory,
  originalRepos: RepoAnalysis[],
  matches: (repo: RepoAnalysis) => boolean,
  lastScannedAt: string
): CapabilityDerivation | null {
  if (originalRepos.length === 0) return null;
  const withSignal = originalRepos.filter(matches);
  if (withSignal.length === 0) return null;

  return {
    category,
    score: Math.round((withSignal.length / originalRepos.length) * 100),
    confidence: withRecencyCap(confidenceFor(withSignal.length), lastScannedAt),
    evidenceCount: withSignal.length,
    lastVerifiedAt: lastScannedAt,
    contexts: ["github"],
  };
}

/** Arena-sourced score: real server-computed correctness across completed programming_fundamentals attempts. */
function deriveProgrammingFromArena(attempts: ArenaProgrammingEvidence[]): CapabilityDerivation | null {
  if (attempts.length === 0) return null;
  const totalAnswered = attempts.reduce((sum, a) => sum + a.answeredCount, 0);
  if (totalAnswered === 0) return null;
  const totalCorrect = attempts.reduce((sum, a) => sum + a.correctCount, 0);
  const lastVerifiedAt = attempts.reduce((latest, a) => (a.completedAt > latest ? a.completedAt : latest), attempts[0].completedAt);

  return {
    category: "Programming",
    score: Math.round((totalCorrect / totalAnswered) * 100),
    confidence: withRecencyCap(confidenceFor(attempts.length), lastVerifiedAt),
    evidenceCount: attempts.length,
    lastVerifiedAt,
    contexts: ["arena"],
  };
}

/** Two independent verified sources agreeing on the same category is stronger evidence than either alone. */
function mergeProgramming(
  github: CapabilityDerivation | null,
  arena: CapabilityDerivation | null
): CapabilityDerivation | null {
  if (!github) return arena;
  if (!arena) return github;

  const evidenceCount = github.evidenceCount + arena.evidenceCount;
  const score = Math.round((github.score * github.evidenceCount + arena.score * arena.evidenceCount) / evidenceCount);
  const lastVerifiedAt = github.lastVerifiedAt > arena.lastVerifiedAt ? github.lastVerifiedAt : arena.lastVerifiedAt;

  return {
    category: "Programming",
    score,
    confidence: withRecencyCap(confidenceFor(evidenceCount), lastVerifiedAt),
    evidenceCount,
    lastVerifiedAt,
    contexts: ["github", "arena"],
  };
}

/**
 * Pure, deterministic derivation of the capability-taxonomy profile from
 * already-fetched, already-verified evidence. No network call, no AI call
 * — every value here is reproducible from its inputs. See
 * docs/code-dna-discovery.md for why only GitHub scan evidence and
 * completed Arena `programming_fundamentals` attempts feed this (the only
 * two evidence sources in this codebase that are actually server-verified
 * end to end), and why 8 of the 13 taxonomy categories never appear —
 * there is no real evidence source for them today, so they are omitted
 * rather than invented.
 */
export function deriveCapabilityProfile(
  githubScan: GithubScanResult | null,
  githubLastScannedAt: string | null,
  arenaProgrammingAttempts: ArenaProgrammingEvidence[]
): CapabilityDerivation[] {
  const originalRepos = githubScan ? githubScan.repos.filter((r) => !r.isFork) : [];
  const hasGithubEvidence = Boolean(githubScan && githubLastScannedAt);
  const lastScannedAt = githubLastScannedAt ?? "";

  const githubProgramming = hasGithubEvidence
    ? deriveFromRepoSignal("Programming", originalRepos, GITHUB_CATEGORY_MATCHERS.Programming!, lastScannedAt)
    : null;
  const arenaProgramming = deriveProgrammingFromArena(arenaProgrammingAttempts);

  const results: (CapabilityDerivation | null)[] = [mergeProgramming(githubProgramming, arenaProgramming)];

  if (hasGithubEvidence) {
    for (const category of ["Frontend Engineering", "Backend Engineering", "Testing", "DevOps/Infrastructure"] as const) {
      results.push(deriveFromRepoSignal(category, originalRepos, GITHUB_CATEGORY_MATCHERS[category]!, lastScannedAt));
    }
  }

  return results.filter((r): r is CapabilityDerivation => r !== null);
}
