import { describe, expect, it } from "vitest";
import { isLaunchpadOpen, isPlanBTerm, isStreamTerm } from "./term";

describe("isPlanBTerm", () => {
  it("opens in 3-1 and stays open, never before", () => {
    expect(isPlanBTerm(3, 1)).toBe(true);
    expect(isPlanBTerm(3, 2)).toBe(true);
    expect(isPlanBTerm(4, 1)).toBe(true);
    expect(isPlanBTerm(2, 2)).toBe(false);
    expect(isPlanBTerm(2, 1)).toBe(false);
    expect(isPlanBTerm(null, 1)).toBe(false);
    expect(isPlanBTerm(3, null)).toBe(false);
  });
});

describe("isLaunchpadOpen", () => {
  it("opens in the final year of a 4-year program, not before", () => {
    expect(isLaunchpadOpen(3, 2023, 2027)).toBe(false);
    expect(isLaunchpadOpen(4, 2023, 2027)).toBe(true);
  });
  it("stays closed when years are unknown", () => {
    expect(isLaunchpadOpen(null, 2023, 2027)).toBe(false);
    expect(isLaunchpadOpen(4, null, null)).toBe(false);
  });
});

describe("isStreamTerm", () => {
  it("opens in 2nd year and stays open; 1st year waits", () => {
    expect(isStreamTerm(1)).toBe(false);
    expect(isStreamTerm(2)).toBe(true);
    expect(isStreamTerm(4)).toBe(true);
  });
  it("never locks out a student whose year is unknown", () => {
    expect(isStreamTerm(null)).toBe(true);
  });
});

import { isFirstSemesterOpen } from "./term";

describe("isFirstSemesterOpen: the college's semester-1 date", () => {
  const base = { milestoneYear: 3, today: "2026-08-10" };
  it("holds the milestone back only in that year's first semester, until the college's date arrives", () => {
    expect(isFirstSemesterOpen({ ...base, year: 3, semester: 1, firstSemesterStartsOn: "2026-09-01" })).toBe(false);
    expect(isFirstSemesterOpen({ ...base, year: 3, semester: 1, firstSemesterStartsOn: "2026-08-10" })).toBe(true);
    expect(isFirstSemesterOpen({ ...base, year: 3, semester: 1, firstSemesterStartsOn: "2026-07-01" })).toBe(true);
  });
  it("changes nothing without a date, in the second semester, or in a later year", () => {
    expect(isFirstSemesterOpen({ ...base, year: 3, semester: 1, firstSemesterStartsOn: null })).toBe(true);
    expect(isFirstSemesterOpen({ ...base, year: 3, semester: 2, firstSemesterStartsOn: "2026-09-01" })).toBe(true);
    expect(isFirstSemesterOpen({ ...base, year: 4, semester: 1, firstSemesterStartsOn: "2026-09-01" })).toBe(true);
  });
  it("is not about earlier years: the year rule still decides those", () => {
    expect(isFirstSemesterOpen({ ...base, year: 2, semester: 1, firstSemesterStartsOn: "2026-09-01" })).toBe(true);
  });
});

describe("isFirstSemesterOpen: a date far in the future is next cycle's", () => {
  const base = { year: 3, semester: 1, milestoneYear: 3, today: "2026-10-01" };
  it("holds back a date up to four months away, but not one entered a year early", () => {
    expect(isFirstSemesterOpen({ ...base, firstSemesterStartsOn: "2027-01-28" })).toBe(false); // 119 days
    expect(isFirstSemesterOpen({ ...base, firstSemesterStartsOn: "2027-02-05" })).toBe(true); // 127 days
    expect(isFirstSemesterOpen({ ...base, firstSemesterStartsOn: "2027-07-01" })).toBe(true);
  });
});
