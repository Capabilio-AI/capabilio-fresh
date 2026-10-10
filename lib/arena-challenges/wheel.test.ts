import { describe, expect, it } from "vitest";
import { WHEEL_COUNTS, rotationFor, segmentAt } from "./wheel";

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
