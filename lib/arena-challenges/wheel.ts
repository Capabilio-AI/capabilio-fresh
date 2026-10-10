// Weekly challenge-count wheel: every Sunday the student spins once and the card it lands on is that week's challenge count.
export const WHEEL_COUNTS = [4, 5, 6, 7, 8, 9] as const;
export const SEGMENT_DEGREES = 360 / WHEEL_COUNTS.length;
export const FULL_TURNS = 6;

/** Pure. Local-date key (YYYY-MM-DD) of the Sunday on or before `date`: the spin for a week opens at that Sunday's 00:00. */
export function spinWeekKey(date: Date): string {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  const p = (n: number) => String(n).padStart(2, "0");
  return `${sunday.getFullYear()}-${p(sunday.getMonth() + 1)}-${p(sunday.getDate())}`;
}

/** Server-side pick in the real feature; the prototype calls it on the client with Math.random. */
export function pickIndex(rand: (max: number) => number = (n) => Math.floor(Math.random() * n)): number {
  return rand(WHEEL_COUNTS.length);
}

/**
 * Total rotation (degrees, clockwise) that brings segment `index` under the pointer at the top, always spinning forward
 * several full turns from `current`. `jitter` (-0.4..0.4 of a segment) stops the needle off-centre so it feels physical.
 */
export function rotationFor(index: number, current: number, jitter = 0): number {
  const landing = (360 - (index * SEGMENT_DEGREES + jitter * SEGMENT_DEGREES) + 360) % 360;
  const delta = (landing - (current % 360) + 360) % 360;
  return current + FULL_TURNS * 360 + delta;
}

/** Which segment is under the pointer for a given rotation. */
export function segmentAt(rotation: number): number {
  const a = ((360 - (rotation % 360)) % 360 + 360) % 360;
  return Math.round(a / SEGMENT_DEGREES) % WHEEL_COUNTS.length;
}
