import { describe, expect, it } from "vitest";
import { experienceLevel, levelAtLeast, yearsSince } from "./level";

const NOW = new Date("2026-10-15");

describe("experience level", () => {
  it("treats students as freshers whatever the dates say, and recent graduates as juniors", () => {
    expect(experienceLevel({ stage: "student", startDates: ["2015-01-01"], now: NOW })).toBe("fresher");
    expect(experienceLevel({ stage: "graduate", startDates: [], now: NOW })).toBe("junior");
    expect(experienceLevel({ stage: "graduate", startDates: ["2015-01-01"], now: NOW })).toBe("junior");
  });

  it("grades professionals by years since their earliest job", () => {
    const at = (start: string) => experienceLevel({ stage: "professional", startDates: [start], now: NOW });
    expect(at("2026-03-01")).toBe("fresher");
    expect(at("2025-01-01")).toBe("junior");
    expect(at("2022-06-01")).toBe("mid");
    expect(at("2018-01-01")).toBe("senior");
    expect(at("2017-01-01")).toBe("senior");
    expect(at("2016-01-01")).toBe("expert");
  });

  it("uses the earliest date, ignores blanks and bad dates, and defaults a professional with no dates to junior", () => {
    expect(experienceLevel({ stage: "professional", startDates: [null, "not a date", "2019-01-01", "2025-01-01"], now: NOW })).toBe("senior");
    expect(experienceLevel({ stage: "professional", startDates: ["2010-01-01", "2025-01-01"], now: NOW })).toBe("expert");
    expect(experienceLevel({ stage: "professional", startDates: [null], now: NOW })).toBe("junior");
  });

  it("measures years and orders levels", () => {
    expect(yearsSince("2024-10-15", NOW)).toBeCloseTo(2, 1);
    expect(levelAtLeast("senior", "mid")).toBe(true);
    expect(levelAtLeast("fresher", "junior")).toBe(false);
    expect(levelAtLeast("expert", "senior")).toBe(true);
    expect(levelAtLeast("senior", "expert")).toBe(false);
  });
});
