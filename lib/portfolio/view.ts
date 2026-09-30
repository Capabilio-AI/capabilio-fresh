import { aggregateDemonstratedCapabilities, type DemonstratedCapability, type EvidenceRecord } from "@/lib/evidence/aggregate-capabilities";
import type { PortfolioElo } from "@/lib/portfolio/elo";

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

export interface RadarPoint {
  subject: string;
  value: number;
  [key: string]: string | number;
}

/**
 * Pure. Feeds the portfolio's skill radar. The value is evidence DENSITY
 * (how many verified items back this skill, capped at 100), never a
 * self-assessed skill level — 4+ pieces of evidence maxes the axis out.
 * Returns [] when there's nothing demonstrated yet; the radar simply
 * doesn't render rather than showing an empty/self-reported shape.
 */
export function toRadarData(capabilities: PortfolioCapability[], max = 8): RadarPoint[] {
  return [...capabilities]
    .sort((a, b) => b.evidenceCount - a.evidenceCount)
    .slice(0, max)
    .map((c) => ({ subject: c.skill, value: Math.min(100, c.evidenceCount * 25) }));
}

/**
 * Pure. One short paragraph built entirely from verified counts already on
 * the page — never invented text, consistent with "demonstrated, not claimed".
 */
export function buildProfessionalSummary({
  statedRole,
  groups,
  elo,
  keyEvidence,
}: {
  statedRole: string | null;
  groups: CapabilityGroup[];
  elo: PortfolioElo;
  keyEvidence: string[];
}): string {
  const topSkills = groups
    .flatMap((g) => g.capabilities)
    .slice(0, 3)
    .map((c) => c.skill);
  const direction = statedRole ? `Aspiring ${statedRole}` : "Early-career candidate";

  return [
    topSkills.length ? `${direction} with demonstrated strength in ${topSkills.join(", ")}.` : `${direction}, still building a demonstrated track record.`,
    `Rated ${elo.tier.label} (ELO ${elo.rating}) on Capabilio Arena.`,
    keyEvidence.length ? `Backed by ${keyEvidence.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
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
