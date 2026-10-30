import { describe, expect, it } from "vitest";
import { canDeclareGraduated } from "./finish-studies";

const now = new Date(2026, 8, 1);

describe("canDeclareGraduated", () => {
  it("allows a final-year student", () => {
    expect(canDeclareGraduated({ launchpadOpen: true, endYear: 2027 }, now)).toBe(true);
  });
  it("allows a student whose programme has ended", () => {
    expect(canDeclareGraduated({ launchpadOpen: false, endYear: 2026 }, now)).toBe(true);
  });
  it("blocks an early-year student", () => {
    expect(canDeclareGraduated({ launchpadOpen: false, endYear: 2029 }, now)).toBe(false);
    expect(canDeclareGraduated({ launchpadOpen: false, endYear: null }, now)).toBe(false);
  });
  it("allows when no programme is on file", () => {
    expect(canDeclareGraduated(null, now)).toBe(true);
  });
});
