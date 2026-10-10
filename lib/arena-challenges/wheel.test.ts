import { describe, expect, it } from "vitest";
import { WHEEL_COUNTS, rotationFor, segmentAt, spinWeekKey } from "./wheel";

describe("spinWeekKey", () => {
  it("is the Sunday on or before the date, from 00:00 Sunday", () => {
    expect(spinWeekKey(new Date(2026, 9, 11, 0, 0, 1))).toBe("2026-10-11"); // Sunday
    expect(spinWeekKey(new Date(2026, 9, 10, 23, 59, 59))).toBe("2026-10-04"); // Saturday night: still last week
    expect(spinWeekKey(new Date(2026, 9, 14))).toBe("2026-10-11"); // Wednesday
  });
});

describe("rotationFor", () => {
  it("always lands on the requested card, spins forward, from any starting angle", () => {
    for (let i = 0; i < WHEEL_COUNTS.length; i++) {
      for (const start of [0, 37, 360, 1234.5]) {
        const r = rotationFor(i, start, 0.3);
        expect(r).toBeGreaterThan(start + 360 * 5);
        expect(segmentAt(r)).toBe(i);
      }
    }
  });
});
