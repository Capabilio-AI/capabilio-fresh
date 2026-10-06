import { expect, test } from "vitest";
import { computeCurrentAcademicYear } from "./academic-year";

const now = new Date(2026, 9, 6);
test("computes year 4 for a 2023–2027 student in Oct 2026", () => {
  expect(computeCurrentAcademicYear({ startYear: 2023, endYear: 2027, now })?.year).toBe(4);
});
test("override beyond the program length is clamped to the final year", () => {
  expect(computeCurrentAcademicYear({ startYear: 2023, endYear: 2027, override: 6, now })?.year).toBe(4);
});
