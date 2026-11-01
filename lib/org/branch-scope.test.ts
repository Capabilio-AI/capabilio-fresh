import { describe, expect, it } from "vitest";
import { resolveMaterialBranch, resolveProjectScope, sameBranch, staffBranchScope } from "./branch-scope";

describe("staffBranchScope", () => {
  it("confines staff that name a branch, and nobody else", () => {
    expect(staffBranchScope({ kind: "staff", branch: " CSE " })).toBe("CSE");
    expect(staffBranchScope({ kind: "staff", branch: null })).toBeNull();
    expect(staffBranchScope({ kind: "staff", branch: "  " })).toBeNull();
    expect(staffBranchScope({ kind: "admin", branch: "CSE" })).toBeNull();
  });
});

describe("sameBranch", () => {
  it("ignores case and padding, and never matches empty", () => {
    expect(sameBranch("Computer Science (CSE)", " computer science (cse) ")).toBe(true);
    expect(sameBranch("", "")).toBe(false);
    expect(sameBranch("CSE", "ECE")).toBe(false);
  });
});

describe("resolveMaterialBranch", () => {
  it("forces the scoped branch, accepts a matching request, refuses another branch", () => {
    expect(resolveMaterialBranch("CSE", undefined)).toEqual({ ok: true, value: "CSE" });
    expect(resolveMaterialBranch("CSE", "cse")).toEqual({ ok: true, value: "CSE" });
    expect(resolveMaterialBranch("CSE", "ECE").ok).toBe(false);
  });
  it("leaves unscoped members free", () => {
    expect(resolveMaterialBranch(null, "ECE")).toEqual({ ok: true, value: "ECE" });
  });
});

describe("resolveProjectScope", () => {
  it("pins a scoped member's project to their branch", () => {
    expect(resolveProjectScope("CSE", undefined)).toEqual({ ok: true, value: ["CSE"] });
    expect(resolveProjectScope("CSE", ["cse"])).toEqual({ ok: true, value: ["CSE"] });
    expect(resolveProjectScope("CSE", ["CSE", "ECE"]).ok).toBe(false);
  });
  it("lets an unscoped member choose, or open it to everyone", () => {
    expect(resolveProjectScope(null, ["CSE", "ECE"])).toEqual({ ok: true, value: ["CSE", "ECE"] });
    expect(resolveProjectScope(null, [])).toEqual({ ok: true, value: null });
  });
});

import { calendarScope, resolveCalendarBranch, branchMatchesAny, normalizeEligibleBranches } from "./branch-scope";

describe("calendar branch scope", () => {
  it("lets an admin set any branch, and a branch-scoped member only their own", () => {
    expect(calendarScope({ kind: "admin", branch: null })).toEqual({ ok: true, scope: null });
    expect(calendarScope({ kind: "staff", branch: " CSE " })).toEqual({ ok: true, scope: "CSE" });
    expect(resolveCalendarBranch(null, "ECE")).toEqual({ ok: true, value: "ECE" });
    expect(resolveCalendarBranch("CSE", "cse ")).toEqual({ ok: true, value: "CSE" });
  });
  it("refuses another department and the college-wide '*' rather than quietly changing them", () => {
    expect(resolveCalendarBranch("CSE", "ECE")).toMatchObject({ ok: false });
    expect(resolveCalendarBranch("CSE", "*")).toMatchObject({ ok: false });
  });
  it("gives staff with no department no scope at all, since a date moves unlocks for a whole cohort", () => {
    expect(calendarScope({ kind: "staff", branch: null })).toMatchObject({ ok: false });
    expect(calendarScope({ kind: "staff", branch: "  " })).toMatchObject({ ok: false });
  });
});

describe("visits open to all branches", () => {
  const aiml = "Artificial Intelligence and Machine Learning (AI/ML)";
  it("a visit typed as 'all' reaches every student, including one with no branch on record", () => {
    for (const typed of ["all", "All", "All branches", "everyone"]) {
      expect(branchMatchesAny([typed], aiml)).toBe(true);
      expect(branchMatchesAny([typed], null)).toBe(true);
    }
  });
  it("still limits a visit that names real branches", () => {
    expect(branchMatchesAny(["CSE", "ECE"], aiml)).toBe(false);
    expect(branchMatchesAny(["CSE", "AI/ML"], aiml)).toBe(true);
  });
  it("stores 'all' as no restriction", () => {
    expect(normalizeEligibleBranches(["all"])).toBeNull();
    expect(normalizeEligibleBranches(["CSE", "All branches"])).toBeNull();
    expect(normalizeEligibleBranches([])).toBeNull();
    expect(normalizeEligibleBranches([" CSE ", "ECE"])).toEqual(["CSE", "ECE"]);
  });
});
