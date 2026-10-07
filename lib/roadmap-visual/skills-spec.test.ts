import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ChildSkillsFile, validateChildSkills, type ChildSkillSpec, type ExistingSkill } from "./skills-spec";

const existing: ExistingSkill[] = [
  { key: "SKILL_SQL", name: "SQL", status: "active", category: "Data" },
  { key: "SKILL_PYTHON", name: "Python", status: "active", category: "Programming" },
  { key: "SKILL_OLD", name: "Old Thing", status: "candidate", category: null },
];
const aliases = new Set(["joins", "group by"]);
const s = (over: Partial<ChildSkillSpec> = {}): ChildSkillSpec => ({ key: "SKILL_SQL_JOINS", name: "SQL Joins", parent: "SQL", description: "Combines tables with inner and outer joins correctly.", ...over });

describe("validateChildSkills", () => {
  it("accepts a new child of an existing active skill", () => expect(validateChildSkills([s()], existing, aliases).errors).toEqual([]));
  it("rejects a parent that does not exist or is not active", () => {
    expect(validateChildSkills([s({ parent: "Nope" })], existing, aliases).errors.join(" ")).toMatch(/not an existing active skill/);
    expect(validateChildSkills([s({ parent: "Old Thing" })], existing, aliases).errors.join(" ")).toMatch(/not an existing active skill/);
  });
  it("rejects a name or key that would collide with the taxonomy or the resolver's aliases", () => {
    expect(validateChildSkills([s({ name: "Joins", key: "SKILL_JOINS" })], existing, aliases).errors.join(" ")).toMatch(/already an alias/);
    expect(validateChildSkills([s({ name: "sql", key: "SKILL_X1" })], existing, aliases).errors.join(" ")).toMatch(/too close to the existing skill "SQL"/);
    expect(validateChildSkills([s({ key: "SKILL_SQL" })], existing, aliases).errors.join(" ")).toMatch(/key is already used/);
  });
  it("rejects duplicates inside the file", () => {
    const { errors } = validateChildSkills([s(), s({ key: "SKILL_OTHER" })], existing, aliases);
    expect(errors.join(" ")).toMatch(/Duplicate name/);
    expect(validateChildSkills([s(), s({ name: "Other Name" })], existing, aliases).errors.join(" ")).toMatch(/Duplicate key/);
  });
});

describe("the authored child skills file", () => {
  const file = ChildSkillsFile.parse(JSON.parse(readFileSync("content/skills/roadmap-child-skills.json", "utf8")));
  it("parses and is internally consistent", () => {
    expect(file.skills.length).toBeGreaterThan(50);
    expect(new Set(file.skills.map((x) => x.key)).size).toBe(file.skills.length);
    expect(new Set(file.skills.map((x) => x.name.toLowerCase())).size).toBe(file.skills.length);
  });
  it("only refines the starter taxonomy's existing skills (parents are not invented)", () => {
    const parents = new Set(file.skills.map((x) => x.parent));
    expect([...parents].sort()).toEqual(
      ["Algorithms", "API Design", "Artificial Intelligence Fundamentals", "BI / Dashboarding", "Computer Networks", "Data Analysis", "Data Cleaning", "Data Structures", "Database Management Systems", "Deep Learning", "Excel / Spreadsheets", "Linear Algebra", "Linux", "Machine Learning", "Natural Language Processing", "Object-Oriented Programming", "Operating Systems", "Probability", "Programming Fundamentals", "Python", "SQL", "Software Engineering", "Software Testing", "Statistics", "System Design", "Technical Communication", "Version Control"].sort()
    );
  });
});
