import { describe, expect, it } from "vitest";
import { canAttemptTier, currentTier, suggestedTier, tierPassed, tierRows } from "./tiers";

describe("tiers", () => {
  it("suggests a tier from the year and never past Expert", () => {
    expect([null, 1, 2, 3, 4, 6].map(suggestedTier)).toEqual([1, 1, 2, 3, 4, 4]);
  });
  it("opens a tier's proof only once the tier below is proven", () => {
    expect(canAttemptTier(1, [])).toBe(true);
    expect(canAttemptTier(2, [])).toBe(false);
    expect(canAttemptTier(3, [1])).toBe(false);
    expect(canAttemptTier(3, [1, 2])).toBe(true);
  });
  it("works on the first unproven tier, null when all are proven", () => {
    expect(currentTier([])).toBe(1);
    expect(currentTier([1, 3])).toBe(2);
    expect(currentTier([1, 2, 3, 4])).toBeNull();
  });
  it("passes at 70 percent and rejects empty or impossible scores", () => {
    expect(tierPassed(7, 10)).toBe(true);
    expect(tierPassed(6, 10)).toBe(false);
    expect(tierPassed(0, 0)).toBe(false);
    expect(tierPassed(11, 10)).toBe(false);
  });
});

describe("tierRows", () => {
  it("marks proven, the next open one and the rest locked, and suggests by year", () => {
    const rows = tierRows([1], 3);
    expect(rows.map((r) => r.status)).toEqual(["proven", "open", "locked", "locked"]);
    expect(rows.find((r) => r.suggested)?.n).toBe(3);
  });
});
