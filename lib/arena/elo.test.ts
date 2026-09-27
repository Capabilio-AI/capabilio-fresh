import { describe, expect, it } from "vitest";
import { computeEloUpdate } from "./elo";

describe("computeEloUpdate", () => {
  it("keeps rating unchanged when actual score exactly matches expected at baseline", () => {
    // At ratingBefore === baseline (1200), expected = 0.5. Scoring 5/10 = 0.5 actual too.
    const result = computeEloUpdate(5, 10, 1200);
    expect(result.ratingDelta).toBe(0);
    expect(result.ratingAfter).toBe(1200);
  });

  it("gains rating for a perfect score against the baseline", () => {
    const result = computeEloUpdate(10, 10, 1200);
    expect(result.ratingDelta).toBeGreaterThan(0);
    expect(result.ratingAfter).toBe(1200 + result.ratingDelta);
  });

  it("loses rating for a zero score against the baseline", () => {
    const result = computeEloUpdate(0, 10, 1200);
    expect(result.ratingDelta).toBeLessThan(0);
  });

  it("makes it harder to gain rating the higher the current rating already is", () => {
    const lowRated = computeEloUpdate(10, 10, 1200);
    const highRated = computeEloUpdate(10, 10, 1800);
    expect(highRated.ratingDelta).toBeLessThan(lowRated.ratingDelta);
  });

  it("never divides by zero when total is 0", () => {
    expect(() => computeEloUpdate(0, 0, 1200)).not.toThrow();
  });
});
