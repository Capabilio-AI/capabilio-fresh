import { describe, expect, it } from "vitest";
import { buildSkillIndex } from "./resolve";
import { extractSkills } from "./extract";

const skills = [
  { id: "sql", name: "SQL", status: "active" },
  { id: "xl", name: "Excel", status: "active" },
  { id: "bi", name: "Power BI", status: "active" },
  { id: "ab", name: "A/B Testing", status: "active" },
  { id: "cpp", name: "C++", status: "active" },
  { id: "go", name: "Go", status: "active" },
  { id: "old", name: "Flash", status: "deprecated" },
];
const aliases = [{ skillId: "bi", alias: "powerbi" }, { skillId: "sql", alias: "structured query language" }];
const index = buildSkillIndex(skills, aliases);
const names = new Map(skills.map((s) => [s.id, s.name]));

describe("extractSkills", () => {
  it("finds catalog skills in free text, in the order they appear, once each", () => {
    const text = "We need a Data Analyst with strong SQL, Excel and Power BI. Experience with sql is essential; knowledge of A/B testing is a plus.";
    expect(extractSkills(text, index, names)).toEqual(["SQL", "Excel", "Power BI", "A/B Testing"]);
  });

  it("matches aliases and the longest phrase, and keeps symbols such as C++", () => {
    expect(extractSkills("Fluent in structured query language and PowerBI, plus C++.", index, names)).toEqual(["SQL", "Power BI", "C++"]);
  });

  it("ignores very short words that are usually ordinary English, such as 'go'", () => {
    expect(extractSkills("You will go to the client site and go through the data.", index, names)).toEqual([]);
  });

  it("ignores deprecated skills and returns nothing for empty or unrelated text", () => {
    expect(extractSkills("Flash animation", index, names)).toEqual([]);
    expect(extractSkills("", index, names)).toEqual([]);
    expect(extractSkills("We make great coffee.", index, names)).toEqual([]);
  });
});
