import { describe, expect, it } from "vitest";
import { studentPhase, unlocksFor } from "./phase";

describe("studentPhase", () => {
  it("walks a student with no role from discover to choose", () => {
    expect(studentPhase(1, false)).toBe("discover");
    expect(studentPhase(null, false)).toBe("discover");
    expect(studentPhase(2, false)).toBe("practice");
    expect(studentPhase(3, false)).toBe("choose");
    expect(studentPhase(4, false)).toBe("choose");
  });
  it("is the role phase whenever a role exists, whatever the year", () => {
    for (const y of [1, 2, 3, 4, null]) expect(studentPhase(y, true)).toBe("role");
  });
});

describe("unlocksFor", () => {
  it("keeps Arena shut for a 1st year with no role, and opens it at 2nd year", () => {
    expect(unlocksFor(1, false).arena).toBe(false);
    expect(unlocksFor(2, false).arena).toBe(true);
  });
  it("opens Arena for a 1st year who chose a role", () => {
    expect(unlocksFor(1, true).arena).toBe(true);
  });
  it("shows Explore only until a role is chosen, and requires a role from 3rd year", () => {
    expect(unlocksFor(1, false).explore).toBe(true);
    expect(unlocksFor(1, true).explore).toBe(false);
    expect(unlocksFor(3, false).roleRequired).toBe(true);
    expect(unlocksFor(2, false).roleRequired).toBe(false);
  });
  it("opens role content only with a role", () => {
    expect(unlocksFor(4, false).roleContent).toBe(false);
    expect(unlocksFor(1, true).roleContent).toBe(true);
  });
});
