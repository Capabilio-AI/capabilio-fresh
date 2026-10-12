import { describe, expect, it } from "vitest";
import { ResumeExtractionSchema } from "@/lib/ai/llm/prompts/resume.v1";
import type { Target } from "@/lib/assess/engine";
import { boostTargets, matchFocusSkills, resumeSkillNames } from "./focus";

const role = [
  { skillId: "s1", name: "SQL" },
  { skillId: "s2", name: "Python" },
  { skillId: "s3", name: "R" },
  { skillId: "s4", name: "Power BI" },
  { skillId: "s5", name: "Statistics" },
];

describe("matchFocusSkills", () => {
  it("matches the same name and whole-word containment, ignoring case and punctuation", () => {
    expect(matchFocusSkills(["sql", "Python programming", "power-bi dashboards"], role)).toEqual(["s1", "s2", "s4"]);
  });
  it("never matches a one-letter skill inside another word", () => {
    expect(matchFocusSkills(["React", "Redis"], role)).toEqual([]);
    expect(matchFocusSkills(["R"], role)).toEqual(["s3"]);
  });
  it("matches nothing when the resume names nothing", () => {
    expect(matchFocusSkills([], role)).toEqual([]);
  });
});

describe("boostTargets", () => {
  const targets: Target[] = [
    { id: "s1", name: "SQL", weight: 4, min: 2, max: 4 },
    { id: "s2", name: "Python", weight: 3, min: 1, max: 1 },
    { id: "s4", name: "Power BI", weight: 2, min: 0, max: 3 },
  ];
  it("asks more about claimed skills: heavier weight, one more guaranteed question, never above the maximum", () => {
    const out = boostTargets(targets, ["s1", "s2"]);
    expect(out[0]).toMatchObject({ weight: 6.4, min: 3 });
    expect(out[1]).toMatchObject({ min: 1 }); // already at its max
    expect(out[2]).toEqual(targets[2]);
  });
  it("leaves everyone else's assessment exactly as it was", () => {
    expect(boostTargets(targets, null)).toEqual(targets);
    expect(boostTargets(targets, [])).toEqual(targets);
  });
});

describe("resumeSkillNames", () => {
  it("lists every skill once, including the skills named inside projects", () => {
    const x = ResumeExtractionSchema.parse({
      isResume: true,
      skills: ["Python", "SQL"],
      projects: [{ name: "Sales dashboard", skills: ["sql", "Power BI"] }],
    });
    expect(resumeSkillNames(x)).toEqual(["Python", "SQL", "Power BI"]);
  });
});
