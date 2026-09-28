import { GITHUB_CATEGORY_MATCHERS, type CapabilityCategory, type CapabilityDerivation } from "./capability-derivation";
import type { RepoAnalysis } from "./github-scan";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Which repos justified a GitHub-sourced category's score — same matcher the score itself was computed from. */
export function matchingRepos(category: CapabilityCategory, originalRepos: RepoAnalysis[]): RepoAnalysis[] {
  const matcher = GITHUB_CATEGORY_MATCHERS[category];
  if (!matcher) return [];
  return originalRepos.filter(matcher);
}

/**
 * A deterministic, template-built explanation of *why* a capability has
 * the score it does — grounded entirely in the derivation's own fields.
 * Never LLM-authored: the number and the sentence describing it must
 * always agree, which an LLM restating a score in its own words cannot
 * guarantee.
 */
export function explainCapability(derivation: CapabilityDerivation, originalRepos: RepoAnalysis[]): string {
  const parts: string[] = [];

  if (derivation.contexts.includes("github")) {
    const repos = matchingRepos(derivation.category, originalRepos);
    const names = repos.slice(0, 5).map((r) => r.name);
    const total = originalRepos.length;
    parts.push(
      `Observed in ${repos.length} of ${total} analyzed original ${total === 1 ? "repository" : "repositories"}` +
        (names.length > 0 ? `: ${names.join(", ")}` : "") +
        (repos.length > names.length ? ", and others" : "") +
        "."
    );
  }

  if (derivation.contexts.includes("arena")) {
    parts.push(
      `${derivation.category === "Programming" ? "Also measured" : "Measured"} across ${derivation.evidenceCount} completed Arena Programming Fundamentals ${derivation.evidenceCount === 1 ? "challenge" : "challenges"}, server-scored — not self-reported.`
    );
  }

  parts.push(`Last verified ${formatDate(derivation.lastVerifiedAt)}.`);

  return parts.join(" ");
}
