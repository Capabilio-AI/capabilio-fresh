import { describe, expect, it } from "vitest";
import { inScope } from "./loaders";
import { resolveProjectScope } from "./branch-scope";

// A project posted by branch-scoped staff must reach exactly that branch's students — the write side (resolveProjectScope)
// and the read side (inScope) have to agree on what "same branch" means.
describe("staff project scope reaches only that branch's students", () => {
  const CSE = "Computer Science and Engineering (CSE)";
  const scope = resolveProjectScope(CSE, undefined);
  const stored = scope.ok ? scope.value : null;

  it("is visible to students of the branch, whatever the casing or padding", () => {
    expect(inScope(stored, CSE)).toBe(true);
    expect(inScope(stored, `  ${CSE.toLowerCase()} `)).toBe(true);
  });
  it("is hidden from other branches and from students with no branch", () => {
    expect(inScope(stored, "Mechanical Engineering")).toBe(false);
    expect(inScope(stored, null)).toBe(false);
  });
  it("an unscoped project (admin, no restriction) stays open to everyone", () => {
    expect(inScope(null, "Mechanical Engineering")).toBe(true);
    expect(inScope([], null)).toBe(true);
  });
});
