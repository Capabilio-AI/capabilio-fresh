import type { GithubScanResult, RepoAnalysis } from "./github-scan";

export interface TechnicalFootprint {
  frontend: string[];
  backend: string[];
  devops: string[];
  other: string[];
}

export interface ProjectEvidenceItem {
  name: string;
  url: string;
  isOriginalWork: boolean;
  hasReadme: boolean;
  hasTests: boolean;
  techSignals: string[];
}

export type EngineeringPracticeState = "observed" | "not_observed" | "not_available";

export interface EvidenceProfile {
  technicalFootprint: TechnicalFootprint;
  projectEvidence: ProjectEvidenceItem[];
  authorshipEvidence: {
    originalRepoCount: number;
    forkedRepoCount: number;
    averageAuthorshipShare: number | null;
  };
  engineeringPractice: {
    testing: EngineeringPracticeState;
    ci: EngineeringPracticeState;
    documentation: EngineeringPracticeState;
  };
  collaborationEvidence: { pullRequestsOpened: number; pullRequestsMerged: number };
  limitations: string[];
}

const CATEGORY_BY_TECH: Record<string, keyof TechnicalFootprint> = {
  TypeScript: "frontend",
  "Next.js": "frontend",
  Angular: "frontend",
  "Node.js": "backend",
  Python: "backend",
  Go: "backend",
  Rust: "backend",
  Java: "backend",
  Ruby: "backend",
  PHP: "backend",
  Docker: "devops",
  "CI/CD (GitHub Actions)": "devops",
  "CI/CD (GitLab)": "devops",
};

function bucketTech(repos: RepoAnalysis[]): TechnicalFootprint {
  const footprint: TechnicalFootprint = { frontend: [], backend: [], devops: [], other: [] };
  const seen = new Set<string>();
  for (const repo of repos) {
    for (const tech of repo.techSignals) {
      if (seen.has(tech)) continue;
      seen.add(tech);
      footprint[CATEGORY_BY_TECH[tech] ?? "other"].push(tech);
    }
  }
  return footprint;
}

function practiceState(repos: RepoAnalysis[], hasIt: (r: RepoAnalysis) => boolean): EngineeringPracticeState {
  if (repos.length === 0) return "not_available";
  return repos.some(hasIt) ? "observed" : "not_observed";
}

/** Every field traces back to scanGithubProfile's real output — no invented facts, no fabricated "no similarity found" claims. */
export function buildEvidenceProfile(scan: GithubScanResult): EvidenceProfile {
  const originalRepos = scan.repos.filter((r) => !r.isFork);
  const forkedRepos = scan.repos.filter((r) => r.isFork);
  const authorshipSamples = originalRepos
    .map((r) => r.authorCommitShare)
    .filter((share): share is number => share !== null);
  const averageAuthorshipShare =
    authorshipSamples.length > 0
      ? authorshipSamples.reduce((sum, s) => sum + s, 0) / authorshipSamples.length
      : null;

  const limitations = [
    "Only public GitHub repositories are analyzed.",
    `Only the top ${scan.repositoriesAnalyzed} most-starred repositories are scanned in detail.`,
    "Commit authorship is estimated from a sample of the 5 most recent commits per repository, not full history.",
    "This is not a plagiarism or code-quality check.",
  ];

  return {
    technicalFootprint: bucketTech(scan.repos),
    projectEvidence: scan.repos.map((r) => ({
      name: r.name,
      url: r.htmlUrl,
      isOriginalWork: !r.isFork,
      hasReadme: r.hasReadme,
      hasTests: r.hasTests,
      techSignals: r.techSignals,
    })),
    authorshipEvidence: {
      originalRepoCount: originalRepos.length,
      forkedRepoCount: forkedRepos.length,
      averageAuthorshipShare,
    },
    engineeringPractice: {
      testing: practiceState(scan.repos, (r) => r.hasTests),
      ci: practiceState(scan.repos, (r) => r.techSignals.some((t) => t.startsWith("CI/CD"))),
      documentation: practiceState(scan.repos, (r) => r.hasReadme),
    },
    collaborationEvidence: {
      pullRequestsOpened: scan.pullRequestsOpened,
      pullRequestsMerged: scan.pullRequestsMerged,
    },
    limitations,
  };
}
