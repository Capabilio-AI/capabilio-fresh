import { describe, expect, it } from "vitest";
import { GRADING_LOCK_TTL_MS, staleGradingCutoff } from "./grading-lock";

describe("staleGradingCutoff", () => {
  it("is exactly the lock timeout before now", () => {
    const now = new Date("2026-10-22T10:00:00.000Z");
    expect(Date.parse(staleGradingCutoff(now))).toBe(now.getTime() - GRADING_LOCK_TTL_MS);
  });

  it("outlasts the 60 s submit route so a live grading is never taken over", () => {
    expect(GRADING_LOCK_TTL_MS).toBeGreaterThan(60_000);
  });
});
