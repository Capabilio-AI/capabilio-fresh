export interface SummaryInput {
  name: string | null;
  role: string | null;
  branch: string | null;
  college: string | null;
  readiness: number | null;
  skills: { name: string; score: number }[];
  verifiedChallenges: number;
  averageScore: number | null;
  githubVerified: boolean;
  githubRepos: number | null;
  projects: number;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * Pure. A short professional summary written only from what is measured and verified: no adjectives the data does not support,
 * and nothing about rank or tier. An empty record yields an honest "building" sentence rather than flattery.
 */
export function buildPortfolioSummary(i: SummaryInput): string {
  const who = [i.branch && `${i.branch} student`, i.college && `at ${i.college}`].filter(Boolean).join(" ") || "Student";
  const target = i.role ? ` working toward a career as ${/^[aeiou]/i.test(i.role) ? "an" : "a"} ${i.role}` : "";
  const out = [`${who}${target}.`];

  const strong = [...i.skills].filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (strong.length) out.push(`Strongest measured skills: ${list(strong.map((s) => `${s.name} (${s.score}%)`))}.`);
  if (i.readiness !== null && i.role) out.push(`Currently ${i.readiness}% of the way to the skills ${/^[aeiou]/i.test(i.role) ? "an" : "a"} ${i.role} role asks for.`);

  const proof: string[] = [];
  if (i.verifiedChallenges > 0) proof.push(`${i.verifiedChallenges} verified work ticket${i.verifiedChallenges === 1 ? "" : "s"}${i.averageScore !== null ? ` at an average score of ${i.averageScore}%` : ""}, graded automatically`);
  if (i.githubVerified) proof.push(`a verified GitHub account${i.githubRepos ? ` with ${i.githubRepos} repositories analysed` : ""}`);
  if (i.projects > 0) proof.push(`${i.projects} project or certificate${i.projects === 1 ? "" : "s"} on file`);
  out.push(proof.length ? `Evidence on record: ${list(proof)}.` : "Still building a verified track record; this page fills in as work is completed.");
  return out.join(" ");
}
