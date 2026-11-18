import { describe, expect, it } from "vitest";
import { isDomainOnly, profileIsNonIt, skillsForPrompt } from "./domain";

describe("profileIsNonIt", () => {
  it("recognises a non-IT role from its own profile, and does not guess from too few skills", () => {
    expect(profileIsNonIt(["technical", "domain", "domain", "professional", "technical", "Data"])).toBe(true);
    expect(profileIsNonIt(["Programming", "Software Engineering", "Data", "DevOps", "technical", "Cloud"])).toBe(false);
    expect(profileIsNonIt(["technical", "domain"])).toBe(false);
  });
});

const skills = [{ name: "Git", category: "Software Engineering" }, { name: "Gear Design", category: "technical" }, { name: "Statistics", category: "Data" }, { name: "Uncategorised", category: null }];

describe("skillsForPrompt", () => {
  it("hides the IT categories from a domain-only role", () => {
    expect(isDomainOnly("mechanical-design-engineer")).toBe(true);
    expect(skillsForPrompt("mechanical-design-engineer", skills).map((s) => s.name)).toEqual(["Gear Design", "Uncategorised"]);
  });
  it("leaves every other role's list alone", () => {
    expect(skillsForPrompt("backend-developer", skills)).toHaveLength(4);
  });
});
