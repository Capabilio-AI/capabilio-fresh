import type { Importance } from "./rollup";

export type NodeType = "SPINE" | "GROUP" | "TOPIC";
export type Stage = "FOUNDATION" | "CORE" | "SPECIALIZATION" | "JOB_READY";
export type Side = "LEFT" | "RIGHT" | "CENTER";
export type EdgeType = "PREREQUISITE" | "CONNECTOR" | "OPTIONAL_PATH";

export interface TemplateNodeSpec {
  key: string;
  parentKey: string | null;
  type: NodeType;
  title: string;
  description?: string;
  /** canonical skill NAME (resolved to an id on import); required for topics, optional for groups */
  skill?: string | null;
  importance: Importance;
  targetLevel?: number | null;
  stage: Stage;
  side: Side;
  order: number;
}
export interface TemplateEdgeSpec {
  from: string;
  to: string;
  type: EdgeType;
}

export interface SkillCatalog {
  /** skill name -> status */
  statusByName: ReadonlyMap<string, "active" | "candidate" | "deprecated">;
}

const STAGE_RANK: Record<Stage, number> = { FOUNDATION: 0, CORE: 1, SPECIALIZATION: 2, JOB_READY: 3 };
const MAX_TOPICS = 400;

/**
 * Pure. Everything that makes a topic tree unusable before it ever reaches a student: a skill that does not exist (or is not active yet),
 * a topic with nothing to score, cycles, orphans, a prerequisite that comes in a later stage than what depends on it, and so on.
 * Skills are NEVER created from here; a missing skill is an error to fix in the taxonomy first.
 */
export function validateTemplateGraph(nodes: TemplateNodeSpec[], edges: TemplateEdgeSpec[], skills: SkillCatalog, opts: { allowPendingSkills?: boolean } = {}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byKey = new Map<string, TemplateNodeSpec>();

  for (const n of nodes) {
    if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(n.key)) errors.push(`Node key "${n.key}" must be lowercase letters, digits and dashes.`);
    if (byKey.has(n.key)) errors.push(`Duplicate node key "${n.key}".`);
    byKey.set(n.key, n);
  }
  if (nodes.length > MAX_TOPICS) errors.push(`A template can have at most ${MAX_TOPICS} nodes.`);
  if (!nodes.some((n) => n.type === "SPINE")) errors.push("A template needs at least one SPINE node.");

  const usedSkills = new Map<string, string>();
  for (const n of nodes) {
    const where = `Node "${n.key}"`;
    if (!n.title.trim()) errors.push(`${where} has no title.`);

    // structure
    if (n.type === "SPINE" && n.parentKey !== null) errors.push(`${where} is a SPINE node and cannot have a parent.`);
    if (n.type === "SPINE" && n.side !== "CENTER") errors.push(`${where} is a SPINE node and must be on the CENTER side.`);
    if (n.type === "GROUP" && n.side === "CENTER") errors.push(`${where} is a GROUP and must be on the LEFT or RIGHT side.`);
    if (n.parentKey !== null) {
      const parent = byKey.get(n.parentKey);
      if (!parent) errors.push(`${where} has a parent "${n.parentKey}" that does not exist.`);
      else if (n.type === "GROUP" && parent.type !== "SPINE") errors.push(`${where} is a GROUP and must sit under a SPINE node.`);
      else if (n.type === "TOPIC" && parent.type === "TOPIC") errors.push(`${where} is a TOPIC and cannot sit under another TOPIC.`);
      else if (n.type === "SPINE") errors.push(`${where} cannot have a parent.`);
    } else if (n.type !== "SPINE") errors.push(`${where} is a ${n.type} and needs a parent.`);

    // scoring
    if (n.type === "TOPIC") {
      if (!n.skill) errors.push(`${where} is a TOPIC and needs a canonical skill.`);
      if (n.targetLevel === null || n.targetLevel === undefined) errors.push(`${where} is a TOPIC and needs a target level.`);
    }
    if (n.targetLevel !== null && n.targetLevel !== undefined && (n.targetLevel < 0 || n.targetLevel > 100 || !Number.isInteger(n.targetLevel))) errors.push(`${where}: target level must be a whole number from 0 to 100.`);
    if (n.skill) {
      const status = skills.statusByName.get(n.skill);
      if (!status) errors.push(`${where}: skill "${n.skill}" does not exist in the taxonomy.`);
      else if (status !== "active") (opts.allowPendingSkills && status === "candidate" ? warnings : errors).push(`${where}: skill "${n.skill}" is ${status}, not active. Review and activate it first.`);
      if (n.type === "TOPIC") {
        const other = usedSkills.get(n.skill);
        if (other) errors.push(`${where}: skill "${n.skill}" is already scored by topic "${other}". Each topic needs its own skill.`);
        usedSkills.set(n.skill, n.key);
      }
    }
  }

  // parent cycles
  for (const n of nodes) {
    const seen = new Set<string>();
    for (let cur: TemplateNodeSpec | undefined = n; cur; cur = cur.parentKey ? byKey.get(cur.parentKey) : undefined) {
      if (seen.has(cur.key)) {
        errors.push(`Parent cycle through "${cur.key}".`);
        break;
      }
      seen.add(cur.key);
    }
  }

  // siblings must have distinct order
  const orders = new Map<string, string[]>();
  for (const n of nodes) {
    const k = `${n.parentKey ?? "-"}|${n.side}|${n.order}`;
    orders.set(k, [...(orders.get(k) ?? []), n.key]);
  }
  for (const [k, keys] of orders) if (keys.length > 1 && !k.startsWith("-|")) warnings.push(`Nodes ${keys.join(", ")} share the same position (${k.replace(/\|/g, " / ")}).`);

  // edges
  const prereq = new Map<string, string[]>();
  for (const e of edges) {
    const a = byKey.get(e.from);
    const b = byKey.get(e.to);
    if (!a || !b) {
      errors.push(`Edge ${e.from} -> ${e.to} refers to a node that does not exist.`);
      continue;
    }
    if (e.from === e.to) errors.push(`Edge on "${e.from}" points at itself.`);
    if (e.type === "PREREQUISITE") {
      prereq.set(e.from, [...(prereq.get(e.from) ?? []), e.to]);
      if (STAGE_RANK[a.stage] > STAGE_RANK[b.stage]) errors.push(`Prerequisite "${e.from}" (${a.stage}) comes in a later stage than "${e.to}" (${b.stage}).`);
    }
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (key: string, path: string[]): boolean => {
    if (state.get(key) === 2) return false;
    if (state.get(key) === 1) {
      errors.push(`Prerequisite cycle: ${[...path.slice(path.indexOf(key)), key].join(" -> ")}.`);
      return true;
    }
    state.set(key, 1);
    for (const next of prereq.get(key) ?? []) if (visit(next, [...path, key])) return true;
    state.set(key, 2);
    return false;
  };
  for (const k of prereq.keys()) if (visit(k, [])) break;

  // every group should hold something
  for (const g of nodes.filter((n) => n.type === "GROUP")) if (!nodes.some((c) => c.parentKey === g.key)) warnings.push(`Group "${g.key}" has no topics.`);
  return { errors, warnings };
}
