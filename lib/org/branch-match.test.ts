import { describe, expect, it } from "vitest";
import { branchMatches } from "./branch-scope";

describe("branchMatches", () => {
  const cse = "Computer Science and Engineering (CSE)";
  it("matches a short code against the full branch name", () => expect(branchMatches("CSE", cse)).toBe(true));
  it("matches the full name and is case-insensitive", () => {
    expect(branchMatches("computer science and engineering", cse)).toBe(true);
    expect(branchMatches(cse, cse)).toBe(true);
  });
  it("does not confuse different branches", () => {
    expect(branchMatches("ECE", cse)).toBe(false);
    expect(branchMatches("CS", "Electronics and Communication Engineering (ECE)")).toBe(false);
    expect(branchMatches("IT", cse)).toBe(false);
  });
  it("never matches a student with no branch", () => expect(branchMatches("CSE", null)).toBe(false));
});
