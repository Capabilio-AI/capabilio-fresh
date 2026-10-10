import { randomInt } from "node:crypto";

export interface RotationSnapshot {
  cycleNumber: number;
  remaining: string[];
  served: string[];
  lastServed: string | null;
}

/** Returns an integer in [0, maxExclusive). Injected so tests can be deterministic. */
export type RandomIndex = (maxExclusive: number) => number;

export const cryptoRandomIndex: RandomIndex = (max) => randomInt(max);

/** Pure. Fisher–Yates. */
export function shuffle<T>(items: readonly T[], randomIndex: RandomIndex): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pure. A fresh bag holding every active area exactly once. With more than
 * one area, the first draw never equals the previous cycle's last draw, so a
 * cycle boundary can't produce an immediate repeat.
 */
export function newCycleBag(active: readonly string[], lastServed: string | null, randomIndex: RandomIndex): string[] {
  const bag = shuffle(active, randomIndex);
  if (bag.length > 1 && bag[0] === lastServed) {
    const swapWith = 1 + randomIndex(bag.length - 1);
    [bag[0], bag[swapWith]] = [bag[swapWith], bag[0]];
  }
  return bag;
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Pure. Brings a persisted rotation in line with the currently enabled skill
 * areas and guarantees a non-empty bag to draw from:
 * - disabled/removed areas leave the remaining bag;
 * - newly enabled areas join the current cycle at a random position, unless
 *   already served this cycle;
 * - an empty bag starts the next cycle.
 * Nothing is consumed here — the head is only popped when an attempt is
 * actually created (commit_rotation_attempt).
 */
export function reconcileRotation(state: RotationSnapshot, active: readonly string[], randomIndex: RandomIndex): { next: RotationSnapshot; changed: boolean } {
  if (active.length === 0) throw new Error("No enabled skill areas for this role.");

  const remaining = state.remaining.filter((a) => active.includes(a));

  if (remaining.length > 0) {
    for (const area of active) {
      if (remaining.includes(area) || state.served.includes(area)) continue;
      remaining.splice(randomIndex(remaining.length + 1), 0, area);
    }
    const next = { ...state, remaining };
    return { next, changed: !sameList(remaining, state.remaining) };
  }

  const next: RotationSnapshot = {
    cycleNumber: state.cycleNumber + 1,
    remaining: newCycleBag(active, state.lastServed, randomIndex),
    served: [],
    lastServed: state.lastServed,
  };
  return { next, changed: true };
}

/**
 * Pure. Puts the student's weakest skill area at the head of the bag (lowest Arena rating first; equal ratings keep their current order).
 * Every area is still served once per cycle, so nothing is starved: weakness only decides the ORDER within the cycle. The area just served
 * is never drawn twice in a row.
 */
export function orderByWeakness(remaining: readonly string[], ratingOf: (area: string) => number, lastServed: string | null): string[] {
  const ordered = remaining.map((area, i) => ({ area, i })).sort((a, b) => ratingOf(a.area) - ratingOf(b.area) || a.i - b.i).map((x) => x.area);
  if (ordered.length > 1 && ordered[0] === lastServed) [ordered[0], ordered[1]] = [ordered[1], ordered[0]];
  return ordered;
}
