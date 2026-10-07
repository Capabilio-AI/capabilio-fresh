import type { GraphNode } from "./graph-types";

/** The few fields that matter when saying what changed; small enough to remember in the browser. */
export interface NodeMemo {
  level: number | null;
  status: GraphNode["status"];
}
export type Memo = Record<string, NodeMemo>;

export interface Change {
  key: string;
  title: string;
  kind: "ASSESSED" | "LEVEL_UP" | "LEVEL_DOWN" | "STATUS";
  from: NodeMemo | null;
  to: NodeMemo;
}

export const memoOf = (nodes: readonly GraphNode[]): Memo => Object.fromEntries(nodes.filter((n) => n.type === "TOPIC").map((n) => [n.key, { level: n.level, status: n.status }]));

/** Pure. What changed in the topics since the remembered state. No memory (a first visit) means nothing to compare, so no changes. */
export function diffNodes(before: Memo | null, nodes: readonly GraphNode[]): Change[] {
  if (!before) return [];
  const out: Change[] = [];
  for (const n of nodes) {
    if (n.type !== "TOPIC") continue;
    const was = before[n.key] ?? null;
    const to = { level: n.level, status: n.status };
    if (!was) continue;
    if (was.level === null && to.level !== null) out.push({ key: n.key, title: n.title, kind: "ASSESSED", from: was, to });
    else if (was.level !== null && to.level !== null && to.level !== was.level) out.push({ key: n.key, title: n.title, kind: to.level > was.level ? "LEVEL_UP" : "LEVEL_DOWN", from: was, to });
    else if (was.status !== to.status) out.push({ key: n.key, title: n.title, kind: "STATUS", from: was, to });
  }
  return out;
}

export const describeChange = (c: Change): string =>
  c.kind === "ASSESSED" ? `${c.title}: now assessed at ${c.to.level}` : c.kind === "STATUS" ? `${c.title}: ${c.from?.status.toLowerCase().replace("_", " ")} → ${c.to.status.toLowerCase().replace("_", " ")}` : `${c.title}: ${c.from?.level} → ${c.to.level}`;
