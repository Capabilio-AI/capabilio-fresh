import { describe, expect, it } from "vitest";
import { summarizeCalendar } from "./github-profile";

describe("summarizeCalendar", () => {
  it("finds the longest streak, active days and weeks", () => {
    const counts = [1, 2, 0, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 2];
    const s = summarizeCalendar(counts);
    expect(s.activeDays).toBe(6);
    expect(s.longestStreak).toBe(3);
    expect(s.activeWeeks).toBe(2);
  });

  it("keeps the current streak alive when today is still empty", () => {
    expect(summarizeCalendar([0, 0, 1, 1, 1, 0]).currentStreak).toBe(3);
  });

  it("ends the current streak after a missed day", () => {
    expect(summarizeCalendar([1, 1, 0, 0]).currentStreak).toBe(0);
  });

  it("sums only the last 90 days for the recency figure", () => {
    const counts = [...Array(100).fill(0), ...Array(90).fill(1)];
    counts[0] = 50;
    expect(summarizeCalendar(counts).last90DaysContributions).toBe(90);
  });
});
