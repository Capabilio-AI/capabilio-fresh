import type { FullRepoAnalysis } from "./github-scan";

export type TechStrength = "strong" | "moderate" | "limited";

export interface TechnologyObservation {
  technology: string;
  strength: TechStrength;
  repoCount: number;
  mostRecentAt: string | null;
}

const RECENCY_WINDOW_DAYS = 365;

function isRecent(iso: string | null): boolean {
  if (!iso) return false;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24) <= RECENCY_WINDOW_DAYS;
}

/**
 * "Observed GitHub usage" per technology — deliberately never based on
 * package/file presence alone. A technology seen in exactly one old,
 * inactive repo is real but weak evidence ("limited"); real strength
 * requires either repetition across repos or recent activity, matching
 * the brief's explicit rule against inflating a single stale config file
 * into a strong claim.
 */
export function deriveTechnologyObservations(repos: FullRepoAnalysis[]): TechnologyObservation[] {
  const byTech = new Map<string, FullRepoAnalysis[]>();
  for (const repo of repos) {
    if (repo.scanStatus === "failed") continue;
    for (const tech of repo.techSignals) {
      const list = byTech.get(tech) ?? [];
      list.push(repo);
      byTech.set(tech, list);
    }
  }

  const observations: TechnologyObservation[] = [];
  for (const [technology, reposForTech] of byTech) {
    const mostRecentAt = reposForTech.reduce<string | null>((latest, r) => {
      if (!r.repoUpdatedAt) return latest;
      return !latest || r.repoUpdatedAt > latest ? r.repoUpdatedAt : latest;
    }, null);
    const recent = isRecent(mostRecentAt);
    const repeated = reposForTech.length >= 2;

    let strength: TechStrength;
    if (repeated && recent) strength = "strong";
    else if (repeated || recent) strength = "moderate";
    else strength = "limited";

    observations.push({ technology, strength, repoCount: reposForTech.length, mostRecentAt });
  }

  return observations.sort((a, b) => b.repoCount - a.repoCount || a.technology.localeCompare(b.technology));
}
