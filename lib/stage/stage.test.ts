import { describe, expect, it } from "vitest";
import { canMove, hasProgrammeEnded, toStage } from "./stage";

describe("career stage", () => {
  it("only moves forward", () => {
    expect(canMove("student", "graduate")).toBe(true);
    expect(canMove("graduate", "professional")).toBe(true);
    expect(canMove("student", "professional")).toBe(true);
    expect(canMove("professional", "graduate")).toBe(false);
    expect(canMove("graduate", "graduate")).toBe(false);
    expect(canMove("graduate", "student")).toBe(false);
  });

  it("treats unknown values as a student", () => {
    expect(toStage(null)).toBe("student");
    expect(toStage("nonsense")).toBe("student");
    expect(toStage("graduate")).toBe("graduate");
  });

  it("ends a programme when the cycle after the final year begins", () => {
    expect(hasProgrammeEnded(2026, new Date(2026, 5, 30))).toBe(false); // June 2026
    expect(hasProgrammeEnded(2026, new Date(2026, 6, 1))).toBe(true); // July 2026
    expect(hasProgrammeEnded(2026, new Date(2027, 0, 5))).toBe(true);
    expect(hasProgrammeEnded(2027, new Date(2026, 8, 1))).toBe(false);
    expect(hasProgrammeEnded(null, new Date(2030, 0, 1))).toBe(false);
  });
});
