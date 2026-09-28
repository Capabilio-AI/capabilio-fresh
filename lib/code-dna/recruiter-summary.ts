import type { FullRepoAnalysis } from "./github-scan";
import type { TechnologyObservation } from "./technology-derivation";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/**
 * The 30-second summary, built entirely from deterministic scan data —
 * no AI call. Replaces the old fingerprint.ts, which had an LLM decide
 * both the score and this text; that's exactly what this feature's rules
 * prohibit. A template can't accidentally write "did not copy" or
 * "definitely the author" the way a model prompt might, however carefully
 * worded — the trust-language rules are enforced by construction, not by
 * instruction.
 */
export function buildRecruiterSummary(username: string, repos: FullRepoAnalysis[], technologies: TechnologyObservation[]): string {
  const ok = repos.filter((r) => r.scanStatus !== "failed");
  if (ok.length === 0) {
    return `No public repository evidence available for @${username} in this scan.`;
  }

  const dates = ok.flatMap((r) => [r.firstCandidateCommitAt, r.lastCandidateCommitAt]).filter((d): d is string => Boolean(d));
  const period =
    dates.length > 0
      ? `${formatDate(dates.reduce((a, b) => (a < b ? a : b)))} to ${formatDate(dates.reduce((a, b) => (a > b ? a : b)))}`
      : null;

  const topTechnologies = technologies.slice(0, 3).map((t) => t.technology);
  const strongest = technologies.find((t) => t.strength === "strong");

  const sentences: string[] = [
    `Activity observed across ${ok.length} ${ok.length === 1 ? "repository" : "repositories"}${period ? ` from ${period}` : ""}.`,
  ];
  if (topTechnologies.length > 0) {
    sentences.push(`Primary observed technologies: ${topTechnologies.join(", ")}.`);
  }
  if (strongest) {
    sentences.push(`Strongest observed contribution area: ${strongest.technology}.`);
  }

  return sentences.join(" ");
}
