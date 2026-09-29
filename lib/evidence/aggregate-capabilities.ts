/** A stored evidence row, post-018_evidence_unification.sql -- shaped independently of generated Supabase types so this compiles before/after a types regeneration. */
export interface EvidenceRecord {
  skill: string;
  sourceType: string;
  evidenceType: string | null;
  sourceUrl: string | null;
  observedAt: string | null;
  confidence: string;
  createdAt: string;
}

export interface DemonstratedCapability {
  skill: string;
  evidenceCount: number;
  sourceMix: string[];
  mostRecentAt: string | null;
  items: EvidenceRecord[];
  /** 0-100 -- see docs/evidence-strength.md for the exact formula. The UI shows "Limited evidence" instead of the raw number below LOW_STRENGTH_THRESHOLD, rather than this being null. */
  strength: number;
}

export const LOW_STRENGTH_THRESHOLD = 25;

const DIRECTNESS_BY_EVIDENCE_TYPE: Record<string, number> = {
  commit_activity: 40,
  arena_result: 35,
  // Organisation project graded by a named staff member (class_grade_group) — human-verified, so as direct as commits.
  staff_graded_project: 40,
  technology_usage: 25,
};

const RECENCY_WINDOW_STRONG_DAYS = 90;
const RECENCY_WINDOW_WEAK_DAYS = 365;

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

/** Pure. See docs/evidence-strength.md for the full reasoning behind each term. */
export function computeCapabilityStrength(items: EvidenceRecord[], sourceMix: string[], mostRecentAt: string | null): number {
  const directness = Math.max(0, ...items.map((i) => DIRECTNESS_BY_EVIDENCE_TYPE[i.evidenceType ?? ""] ?? 15));
  const repetition = Math.min(items.length - 1, 5) * 5;
  const recency = mostRecentAt == null ? 0 : daysSince(mostRecentAt) <= RECENCY_WINDOW_STRONG_DAYS ? 15 : daysSince(mostRecentAt) <= RECENCY_WINDOW_WEAK_DAYS ? 5 : 0;
  const corroboration = sourceMix.length > 1 ? 20 : 0;
  return Math.min(100, directness + repetition + recency + corroboration);
}

const SOURCE_LABEL: Record<string, string> = {
  github_repository: "Observed on GitHub",
  arena_challenge: "Demonstrated in Arena",
};

export function sourceLabel(sourceType: string): string {
  return SOURCE_LABEL[sourceType] ?? sourceType;
}

/**
 * Pure. Groups raw evidence rows into per-skill capability summaries --
 * the evidence count, which sources back it, and the most recent
 * observation, so the UI can show "3 sources, most recent 2 days ago"
 * instead of a bare unexplained number.
 */
export function aggregateDemonstratedCapabilities(rows: EvidenceRecord[]): DemonstratedCapability[] {
  const bySkill = new Map<string, EvidenceRecord[]>();
  for (const row of rows) {
    const existing = bySkill.get(row.skill) ?? [];
    existing.push(row);
    bySkill.set(row.skill, existing);
  }

  return [...bySkill.entries()]
    .map(([skill, items]) => {
      const sourceMix = [...new Set(items.map((i) => i.sourceType))];
      const mostRecentAt = items.reduce<string | null>((latest, i) => {
        const observed = i.observedAt ?? i.createdAt;
        if (!latest || new Date(observed).getTime() > new Date(latest).getTime()) return observed;
        return latest;
      }, null);
      return {
        skill,
        evidenceCount: items.length,
        sourceMix,
        mostRecentAt,
        items,
        strength: computeCapabilityStrength(items, sourceMix, mostRecentAt),
      };
    })
    .sort((a, b) => b.evidenceCount - a.evidenceCount);
}
