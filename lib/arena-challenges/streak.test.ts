import { describe, expect, it } from "vitest";
import { advanceStreak } from "./streak";

describe("advanceStreak", () => {
  it("starts a streak at 1 on the first-ever completion", () => {
    const result = advanceStreak({ currentStreak: 0, longestStreak: 0, lastCompletedWeek: null }, "2026-09-28");
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it("does not change on a second completion the same week", () => {
    const state = { currentStreak: 3, longestStreak: 5, lastCompletedWeek: "2026-09-28" };
    expect(advanceStreak(state, "2026-09-28")).toEqual(state);
  });

  it("increments on a consecutive week", () => {
    const result = advanceStreak({ currentStreak: 3, longestStreak: 5, lastCompletedWeek: "2026-09-28" }, "2026-10-05");
    expect(result.currentStreak).toBe(4);
  });

  it("resets to 1 after a skipped week", () => {
    const result = advanceStreak({ currentStreak: 6, longestStreak: 6, lastCompletedWeek: "2026-09-28" }, "2026-10-12");
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(6);
  });

  it("tracks longestStreak as the running max, not the latest value", () => {
    const result = advanceStreak({ currentStreak: 2, longestStreak: 8, lastCompletedWeek: "2026-09-28" }, "2026-10-05");
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(8);
  });
});
