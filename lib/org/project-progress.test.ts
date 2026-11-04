import { describe, expect, it } from "vitest";
import { countGroups, inProjectScope, orderForStaff } from "./project-progress";

const g = (status: string) => ({ group: { status } });

describe("project progress", () => {
  it("counts groups by stage", () => {
    expect(countGroups([g("forming"), g("submitted"), g("submitted"), g("graded")])).toEqual({ forming: 1, active: 0, submitted: 2, graded: 1, total: 4 });
  });
  it("puts groups waiting for a grade first and keeps the rest in order", () => {
    const out = orderForStaff([{ ...g("graded"), id: 1 }, { ...g("forming"), id: 2 }, { ...g("submitted"), id: 3 }, { ...g("forming"), id: 4 }]);
    expect(out.map((x) => x.id)).toEqual([3, 2, 4, 1]);
  });
  it("matches the department scope the way the database does", () => {
    expect(inProjectScope(null, "CSE")).toBe(true);
    expect(inProjectScope([], null)).toBe(true);
    expect(inProjectScope(["Computer Science and Engineering (CSE)"], " computer science and engineering (cse) ")).toBe(true);
    expect(inProjectScope(["ECE"], "CSE")).toBe(false);
    expect(inProjectScope(["ECE"], null)).toBe(false);
  });
});
