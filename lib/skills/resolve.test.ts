import { describe, expect, it } from "vitest";
import { normalizeSkillText } from "./normalize";
import { buildSkillIndex, resolveSkill } from "./resolve";

const skills = [
  { id: "py", name: "Python", status: "active" },
  { id: "ds", name: "Data Structures", status: "active" },
  { id: "alg", name: "Algorithms", status: "active" },
  { id: "c", name: "C Programming", status: "active" },
  { id: "cpp", name: "C++ Programming", status: "active" },
  { id: "cand", name: "Quantum Computing", status: "candidate" },
  { id: "old", name: "Flash Development", status: "deprecated" },
  { id: "ml1", name: "Machine Learning", status: "active" },
  { id: "ml2", name: "Machine Learnings", status: "active" },
];
const aliases = [
  { skillId: "py", alias: "Python Programming" },
  { skillId: "py", alias: "python language" },
  { skillId: "c", alias: "C" },
  { skillId: "cpp", alias: "C++" },
  { skillId: "cand", alias: "quantum" },
];
const index = buildSkillIndex(skills, aliases);

describe("normalizeSkillText", () => {
  it("lowercases, trims, collapses whitespace and strips punctuation but keeps + and #", () => {
    expect(normalizeSkillText("  Python,   Programming! ")).toBe("python programming");
    expect(normalizeSkillText("C++")).toBe("c++");
    expect(normalizeSkillText("C#")).toBe("c#");
  });
});

describe("resolveSkill", () => {
  it("maps different spellings of one skill to the same id (exact alias)", () => {
    for (const t of ["Python", "Python Programming", "PYTHON  language", "python."]) {
      expect(resolveSkill(t, index)).toMatchObject({ skillId: "py", via: "alias" });
    }
  });
  it("keeps C and C++ apart", () => {
    expect(resolveSkill("C", index)?.skillId).toBe("c");
    expect(resolveSkill("c++", index)?.skillId).toBe("cpp");
  });
  it("fuzzy-matches an unambiguous typo", () => {
    expect(resolveSkill("Data Strucutres", index)).toMatchObject({ skillId: "ds", via: "fuzzy" });
  });
  it("returns null for unknown text (never invents a skill)", () => {
    expect(resolveSkill("Quantum Basket Weaving", index)).toBeNull();
    expect(resolveSkill("", index)).toBeNull();
  });
  it("does not fuzzy-match very short text", () => {
    expect(resolveSkill("pyt", index)).toBeNull();
  });
  it("refuses an ambiguous fuzzy match", () => {
    expect(resolveSkill("Machine Learningz", index)).toBeNull();
  });
  it("never resolves to candidate or deprecated skills", () => {
    expect(resolveSkill("quantum", index)).toBeNull();
    expect(resolveSkill("Quantum Computing", index)).toBeNull();
    expect(resolveSkill("Flash Development", index)).toBeNull();
  });
});
