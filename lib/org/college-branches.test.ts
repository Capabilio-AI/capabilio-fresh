import { describe, expect, it } from "vitest";
import { mergeBranches } from "./college-branches";

describe("mergeBranches", () => {
  it("counts students per branch, ignoring case and spacing, keeping the first spelling", () => {
    const out = mergeBranches(["Computer Science and Engineering (CSE)", " computer science and engineering (cse) ", "Mechanical Engineering", null, ""], []);
    expect(out).toEqual([{ branch: "Computer Science and Engineering (CSE)", students: 2 }, { branch: "Mechanical Engineering", students: 1 }]);
  });
  it("adds curriculum-only branches with zero students, after branches that have students", () => {
    const out = mergeBranches(["ECE"], ["Civil Engineering", "ece"]);
    expect(out.map((b) => b.branch)).toEqual(["ECE", "Civil Engineering"]);
    expect(out[0].students).toBe(1);
    expect(out[1].students).toBe(0);
  });
});
