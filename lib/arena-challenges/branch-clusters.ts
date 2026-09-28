// Confirmed with the user: CSE/IT/AI-related branches share one "common
// challenges" pool (IT_CLUSTER); every other named branch (ECE, EEE, Mech,
// Civil, MBA, MCA, ...) gets its own distinct pool, since they're too
// different from each other and from IT to share content meaningfully.
// Reuses BRANCH_CATALOG's own names/keywords rather than re-declaring a
// second branch list.

export const IT_CLUSTER_SCOPE_KEY = "it-cluster";
export const GENERAL_SCOPE_KEY = "general";
export const IT_CLUSTER_PROMPT_LABEL = "Computer Science / IT / AI & Data Science";
export const GENERAL_PROMPT_LABEL = "General Engineering";

const IT_CLUSTER_BRANCH_NAMES = new Set([
  "Computer Science and Engineering (CSE)",
  "Information Technology (IT)",
  "Artificial Intelligence and Machine Learning (AI/ML)",
  "Artificial Intelligence and Data Science (AI & DS)",
  "Data Science",
  "Computer Science and Business Systems (CSBS)",
]);

// Loose keyword check for branch strings that don't exactly match a
// BRANCH_CATALOG name (free-text institution_memberships.branch values,
// or a branch like "MBA"/"MCA" not in that UG-focused catalog at all).
const IT_KEYWORDS = ["cse", "computer science", "information technology", " it ", "ai/ml", "ai & ds", "artificial intelligence", "machine learning", "data science", "csbs"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pure. Maps a student's free-text branch to a stable arena_challenges
 * scope_key: the shared IT cluster, this branch's own dedicated scope, or
 * a generic fallback when the branch is missing/unrecognizable.
 */
export function clusterKeyForBranch(branch: string | null): string {
  if (!branch || branch.trim().length === 0) return GENERAL_SCOPE_KEY;

  if (IT_CLUSTER_BRANCH_NAMES.has(branch)) return IT_CLUSTER_SCOPE_KEY;

  const padded = ` ${branch.toLowerCase()} `;
  if (IT_KEYWORDS.some((k) => padded.includes(k))) return IT_CLUSTER_SCOPE_KEY;

  const slug = slugify(branch);
  return slug.length > 0 ? `branch-${slug}` : GENERAL_SCOPE_KEY;
}

/** The human-readable subject to hand the challenge generator -- a cluster key isn't a real subject to write about. */
export function promptLabelForBranch(branch: string | null): string {
  if (!branch || branch.trim().length === 0) return GENERAL_PROMPT_LABEL;
  return clusterKeyForBranch(branch) === IT_CLUSTER_SCOPE_KEY ? IT_CLUSTER_PROMPT_LABEL : branch;
}
