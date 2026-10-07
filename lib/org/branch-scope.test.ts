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
