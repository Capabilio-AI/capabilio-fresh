import { aggregateDemonstratedCapabilities, type DemonstratedCapability, type EvidenceRecord } from "@/lib/evidence/aggregate-capabilities";

export interface PortfolioEvidence extends EvidenceRecord {
  metadata: { parentSkill?: string; title?: string; company?: string; skillArea?: string; attemptId?: string } | null;
}

export interface PortfolioCapability extends DemonstratedCapability {
  arenaCount: number;
  githubCount: number;
  evidence: PortfolioEvidence[];
}

export interface CapabilityGroup {
  name: string;
  capabilities: PortfolioCapability[];
}

const GITHUB_GROUP = "Observed in code";

/**
 * Pure. Groups demonstrated capabilities under their parent (Arena evidence
 * carries metadata.parentSkill, e.g. "Data Analysis"); GitHub-only skills go
 * under "Observed in code". A skill backed by both sources appears once,
 * with both counted. Every number comes from the rows passed in.
 */
export function buildCapabilityGroups(rows: PortfolioEvidence[]): CapabilityGroup[] {
  const bySkill = new Map<string, PortfolioEvidence[]>();
  for (const r of rows) bySkill.set(r.skill, [...(bySkill.get(r.skill) ?? []), r]);

  const groups = new Map<string, PortfolioCapability[]>();
  for (const cap of aggregateDemonstratedCapabilities(rows)) {
    const evidence = (bySkill.get(cap.skill) ?? []).sort((a, b) => Date.parse(b.observedAt ?? b.createdAt) - Date.parse(a.observedAt ?? a.createdAt));
    const parent = evidence.find((e) => e.sourceType === "arena_challenge" && e.metadata?.parentSkill)?.metadata?.parentSkill ?? GITHUB_GROUP;
    const capability: PortfolioCapability = {
      ...cap,
      evidence,
      arenaCount: evidence.filter((e) => e.sourceType === "arena_challenge").length,
      githubCount: evidence.filter((e) => e.sourceType === "github_repository").length,
    };
    groups.set(parent, [...(groups.get(parent) ?? []), capability]);
  }

  return [...groups.entries()]
    .map(([name, capabilities]) => ({ name, capabilities: capabilities.sort((a, b) => b.evidenceCount - a.evidenceCount || a.skill.localeCompare(b.skill)) }))
    .sort((a, b) => (a.name === GITHUB_GROUP ? 1 : b.name === GITHUB_GROUP ? -1 : b.capabilities.length - a.capabilities.length));
}

/** Pure. "3 verified Arena tasks · GitHub activity" — never a level, rank or score. */
export function evidenceLine(cap: PortfolioCapability): string {
  const parts: string[] = [];
  if (cap.arenaCount > 0) parts.push(`${cap.arenaCount} verified Arena task${cap.arenaCount === 1 ? "" : "s"}`);
  if (cap.githubCount > 0) parts.push(`GitHub activity (${cap.githubCount} repo${cap.githubCount === 1 ? "" : "s"})`);
  const other = cap.evidenceCount - cap.arenaCount - cap.githubCount;
  if (other > 0) parts.push(`${other} other source${other === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
