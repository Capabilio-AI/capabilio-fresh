import { describe, expect, it } from "vitest";
import { formatCursor, parseCursor } from "./ranked-feed";

describe("cursor", () => {
  it("round-trips, and a fresh request is frozen to a five-minute slot", () => {
    expect(parseCursor(formatCursor(1_790_000_000_000, 40))).toEqual({ asOf: 1_790_000_000_000, offset: 40 });
    const a = parseCursor(null, 1_790_000_100_000);
    const b = parseCursor(null, 1_790_000_200_000);
    expect(a.offset).toBe(0);
    expect(a.asOf % 300_000).toBe(0);
    expect(a.asOf).toBeLessThanOrEqual(1_790_000_100_000);
    expect(b.asOf - a.asOf).toBeLessThanOrEqual(300_000);
  });
  it("ignores a malformed cursor instead of failing", () => {
    expect(parseCursor("abc", 1_790_000_000_000).offset).toBe(0);
    expect(parseCursor("1790000000000.-5", 1_790_000_000_000).offset).toBe(0);
  });
});
