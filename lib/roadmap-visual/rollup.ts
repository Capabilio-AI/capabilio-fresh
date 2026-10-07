export type Importance = "CORE" | "RECOMMENDED" | "OPTIONAL";
export const IMPORTANCE_WEIGHT: Record<Importance, number> = { CORE: 3, RECOMMENDED: 2, OPTIONAL: 1 };

export interface RollupNode {
  key: string;
  parentKey: string | null;
  type: "SPINE" | "GROUP" | "TOPIC";
  importance: Importance;
  /** only meaningful for TOPIC */
  targetLevel: number | null;
}
export interface LeafScore {
  /** null = not assessed */
  level: number | null;
}

export interface Rollup {
  /** share of the target reached across the topics under this node, weighted by importance. null when there are no topics. Unassessed topics count as 0 here. */
  progress: number | null;
  /** share of the topics (by the same weights) that have any evidence at all: how much of `progress` rests on real data */
  evidenceCoverage: number | null;
  topics: number;
  assessedTopics: number;
}

/** Plain-words formula for the drawer; kept beside the code. */
export const ROLLUP_FORMULA =
  "Progress of a group = Σ weight × min(1, level ÷ target) over the topics under it, ÷ Σ weight. Weights: core 3, recommended 2, optional 1. " +
  "A topic with no evidence counts as 0 progress, and evidence coverage shows how many topics actually have evidence.";

/** Pure. Rolls topic scores up the tree. Every non-topic node aggregates ALL topics beneath it, so a group's number is explained by its leaves. */
export function rollUp(nodes: RollupNode[], scores: ReadonlyMap<string, LeafScore>): Map<string, Rollup> {
  const children = new Map<string | null, RollupNode[]>();
  for (const n of nodes) children.set(n.parentKey, [...(children.get(n.parentKey) ?? []), n]);

  const leavesUnder = (key: string): RollupNode[] => (children.get(key) ?? []).flatMap((c) => (c.type === "TOPIC" ? [c, ...leavesUnder(c.key)] : leavesUnder(c.key)));
  const out = new Map<string, Rollup>();
  for (const n of nodes) {
    const leaves = n.type === "TOPIC" ? [n] : leavesUnder(n.key);
    const totalWeight = leaves.reduce((s, l) => s + IMPORTANCE_WEIGHT[l.importance], 0);
    if (leaves.length === 0 || totalWeight === 0) {
      out.set(n.key, { progress: null, evidenceCoverage: null, topics: 0, assessedTopics: 0 });
      continue;
    }
    let reached = 0;
    let assessedWeight = 0;
    let assessed = 0;
    for (const l of leaves) {
      const w = IMPORTANCE_WEIGHT[l.importance];
      const level = scores.get(l.key)?.level ?? null;
      if (level === null) continue;
      assessed++;
      assessedWeight += w;
      reached += w * Math.min(1, level / Math.max(1, l.targetLevel ?? 100));
    }
    out.set(n.key, { progress: Math.round((reached / totalWeight) * 100), evidenceCoverage: Math.round((assessedWeight / totalWeight) * 100), topics: leaves.length, assessedTopics: assessed });
  }
  return out;
}
