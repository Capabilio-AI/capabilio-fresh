import { describe, expect, it } from "vitest";
import { isCareerDirectionWindow } from "./trigger";
import { academicYearStart, computeCurrentAcademicYear } from "./academic-year";

const at = (y: number, m: number) => new Date(y, m - 1, 15);

describe("isCareerDirectionWindow", () => {
  it("is false when end_year − current year == 2", () => expect(isCareerDirectionWindow(2028, at(2026, 9))).toBe(false));
  it("is true at exactly == 1", () => expect(isCareerDirectionWindow(2028, at(2027, 1))).toBe(true));
  it("is true at 0 and for already-past end years", () => {
    expect(isCareerDirectionWindow(2028, at(2028, 3))).toBe(true);
    expect(isCareerDirectionWindow(2026, at(2028, 3))).toBe(true);
  });
  it("is false when end_year is unknown", () => expect(isCareerDirectionWindow(null, at(2030, 1))).toBe(false));
});

describe("academic year", () => {
  it("buckets by cycle start month, not calendar year", () => {
    expect(academicYearStart(at(2026, 6), 7)).toBe(2025);
    expect(academicYearStart(at(2026, 7), 7)).toBe(2026);
  });
  it("computes year of study from start_year", () => {
    expect(computeCurrentAcademicYear({ startYear: 2024, now: at(2026, 9) })).toEqual({ year: 3, source: "computed" });
    expect(computeCurrentAcademicYear({ startYear: 2024, now: at(2026, 3) })).toEqual({ year: 2, source: "computed" });
  });
  it("clamps to year 1 before the first cycle begins", () => {
    expect(computeCurrentAcademicYear({ startYear: 2026, now: at(2026, 3) })?.year).toBe(1);
  });
  it("manual override wins; unknown start yields null", () => {
    expect(computeCurrentAcademicYear({ startYear: 2024, override: 5, now: at(2026, 9) })).toEqual({ year: 5, source: "override" });
    expect(computeCurrentAcademicYear({ startYear: null })).toBeNull();
  });
});
