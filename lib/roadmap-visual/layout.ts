/**
 * Pure layout of a roadmap tree in the familiar "spine and branches" shape: a vertical spine of stages down the middle; each stage has section boxes
 * (groups) to its left and right, and each section's topics fan out beyond it. Coordinates come from the tree's data, never from React.
 */
export interface LayoutInput {
  key: string;
  parentKey: string | null;
  type: "SPINE" | "GROUP" | "TOPIC";
  side: "LEFT" | "RIGHT" | "CENTER";
  order: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Layout {
  boxes: Record<string, Box>;
  bounds: Box;
}

export const SPINE_W = 250;
export const SPINE_H = 58;
export const GROUP_W = 200;
export const GROUP_H = 50;
export const TOPIC_W = 240;
export const TOPIC_H = 46;
export const TOPIC_GAP = 10;
export const GROUP_GAP = 24;
export const SPINE_TO_GROUP = 56;
export const GROUP_TO_TOPIC = 64;
export const ROW_GAP = 90;

const topicsHeight = (n: number) => Math.max(GROUP_H, n * TOPIC_H + Math.max(0, n - 1) * TOPIC_GAP);

export function layoutRoadmap(nodes: LayoutInput[]): Layout {
  const children = new Map<string | null, LayoutInput[]>();
  for (const n of nodes) children.set(n.parentKey, [...(children.get(n.parentKey) ?? []), n]);
  const sorted = (k: string | null, pred: (n: LayoutInput) => boolean) => (children.get(k) ?? []).filter(pred).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const boxes: Record<string, Box> = {};
  let cursor = 0;

  for (const spine of sorted(null, (n) => n.type === "SPINE")) {
    const stacks = (["LEFT", "RIGHT"] as const).map((side) => sorted(spine.key, (n) => n.type === "GROUP" && n.side === side).map((g) => ({ g, topics: sorted(g.key, (n) => n.type === "TOPIC") })));
    const heights = stacks.map((s) => s.reduce((h, { topics }, i) => h + topicsHeight(topics.length) + (i ? GROUP_GAP : 0), 0));
    const rowH = Math.max(SPINE_H, ...heights);
    boxes[spine.key] = { x: -SPINE_W / 2, y: cursor + (rowH - SPINE_H) / 2, w: SPINE_W, h: SPINE_H };

    stacks.forEach((stack, s) => {
      const groupX = s === 0 ? -(SPINE_W / 2 + SPINE_TO_GROUP + GROUP_W) : SPINE_W / 2 + SPINE_TO_GROUP;
      const topicX = s === 0 ? groupX - GROUP_TO_TOPIC - TOPIC_W : groupX + GROUP_W + GROUP_TO_TOPIC;
      let y = cursor + (rowH - heights[s]) / 2;
      for (const { g, topics } of stack) {
        const h = topicsHeight(topics.length);
        boxes[g.key] = { x: groupX, y: y + (h - GROUP_H) / 2, w: GROUP_W, h: GROUP_H };
        let ty = y + (h - (topics.length * TOPIC_H + Math.max(0, topics.length - 1) * TOPIC_GAP)) / 2;
        for (const t of topics) {
          boxes[t.key] = { x: topicX, y: ty, w: TOPIC_W, h: TOPIC_H };
          ty += TOPIC_H + TOPIC_GAP;
        }
        y += h + GROUP_GAP;
      }
    });
    cursor += rowH + ROW_GAP;
  }

  const all = Object.values(boxes);
  if (all.length === 0) return { boxes, bounds: { x: 0, y: 0, w: 0, h: 0 } };
  const minX = Math.min(...all.map((b) => b.x));
  const maxX = Math.max(...all.map((b) => b.x + b.w));
  const maxY = Math.max(...all.map((b) => b.y + b.h));
  return { boxes, bounds: { x: minX, y: 0, w: maxX - minX, h: maxY } };
}
