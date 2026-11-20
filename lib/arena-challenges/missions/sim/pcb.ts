// A small PCB: a grid of 1 mm cells, fixed parts (the MCU, the power connector), mounting keep-outs, and parts the student places and values.
// Pure geometry: distances are measured between part centres and pin cells, overlap is cell overlap.

export interface Box { x: number; y: number; w: number; h: number }
export interface Pin { x: number; y: number }
export interface PartDef {
  id: string;
  label: string;
  w: number;
  h: number;
  /** value choices, if the part has one (capacitance, resistance) */
  options?: string[];
}
export interface Placement { x: number; y: number; v: number }
export interface Board {
  cols: number;
  rows: number;
  mcu: Box;
  connector: Box;
  keepouts: Box[];
  pins: { vdd: Pin; oscA: Pin; oscB: Pin; power: Pin };
}

export const centre = (b: Box): Pin => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export const dist = (a: Pin, b: Pin): number => Math.hypot(a.x - b.x, a.y - b.y);
export const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const inside = (b: Box, board: Board): boolean => b.x >= 0 && b.y >= 0 && b.x + b.w <= board.cols && b.y + b.h <= board.rows;

export const boxOf = (def: PartDef, p: Placement): Box => ({ x: p.x, y: p.y, w: def.w, h: def.h });

/** Why a placement set is not a legal board, one sentence per problem; empty when every part is placed legally. */
export function legality(defs: PartDef[], placed: Map<string, Placement>, board: Board): string[] {
  const problems: string[] = [];
  const missing = defs.filter((d) => !placed.has(d.id));
  if (missing.length) problems.push(`${missing.length} part(s) are not placed yet`);
  const fixed: Box[] = [board.mcu, board.connector, ...board.keepouts];
  const boxes = defs.flatMap((d) => (placed.has(d.id) ? [{ d, b: boxOf(d, placed.get(d.id)!) }] : []));
  for (const { d, b } of boxes) {
    if (!inside(b, board)) problems.push(`${d.label} hangs off the board`);
    if (fixed.some((f) => overlaps(b, f))) problems.push(`${d.label} sits on the MCU, the connector or a mounting hole`);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i].b, boxes[j].b)) problems.push(`${boxes[i].d.label} overlaps ${boxes[j].d.label}`);
  return problems;
}

/**
 * The nearest legal top-left cell for a part, searching outwards from an anchor: used to build the reference layout. `extra` can add a rule
 * (for example "at least 8 mm from the crystal"). Null when the board has no room.
 */
export function findSpot(def: PartDef, anchor: Pin, board: Board, taken: Box[], extra: (b: Box) => boolean = () => true): Placement | null {
  let best: { p: Placement; d: number } | null = null;
  for (let y = 0; y + def.h <= board.rows; y++) {
    for (let x = 0; x + def.w <= board.cols; x++) {
      const b: Box = { x, y, w: def.w, h: def.h };
      if ([board.mcu, board.connector, ...board.keepouts, ...taken].some((t) => overlaps(b, t)) || !extra(b)) continue;
      const d = dist(centre(b), anchor);
      if (!best || d < best.d) best = { p: { x, y, v: 0 }, d };
    }
  }
  return best?.p ?? null;
}
