import { describe, expect, it } from "vitest";
import { latestResultByArea, resultOf } from "./result";

describe("ticket result", () => {
  it("reads pass, miss and no grade", () => {
    expect(resultOf({ passed: true })).toBe("passed");
    expect(resultOf({ passed: false, timed_out: true })).toBe("failed");
    expect(resultOf(null)).toBeNull();
    expect(resultOf({})).toBeNull();
  });

  it("lets the newest graded ticket of an area decide, and ignores open ones", () => {
    const rows = [
      { skill_area_key: "sql", grade: { passed: true }, assigned_at: "2026-11-01T10:00:00Z" },
      { skill_area_key: "sql", grade: { passed: false }, assigned_at: "2026-11-02T10:00:00Z" },
      { skill_area_key: "statistics", grade: { passed: true }, assigned_at: "2026-11-02T09:00:00Z" },
      { skill_area_key: "python", grade: null, assigned_at: "2026-11-02T08:00:00Z" },
    ];
    expect(latestResultByArea(rows)).toEqual(new Map([["sql", "failed"], ["statistics", "passed"]]));
  });
});
