import { describe, expect, it } from "vitest";
import { categoryFor, groupSkills, monthsFor, sizeOf, validateSkill, type ProSkill } from "./skills";

const ID = "11111111-1111-4111-8111-111111111111";
const sk = (name: string, category: string, jobIds: string[] = []): ProSkill => ({ id: name, name, category, level: "working", source: "added", jobIds });

describe("validateSkill", () => {
  it("accepts a skill, tidies it and defaults the category", () => {
    expect(validateSkill({ name: "  Apache   Kafka ", level: "expert", jobIds: [ID, ID] })).toEqual({ ok: true, value: { name: "Apache Kafka", category: "Other", level: "expert", jobIds: [ID] } });
  });
  it("refuses a blank name, a bad level and a bad job id", () => {
    expect(validateSkill({ name: " ", level: "expert" }).ok).toBe(false);
    expect(validateSkill({ name: "Go", level: "guru" }).ok).toBe(false);
    expect(validateSkill({ name: "Go", level: "expert", jobIds: ["nope"] }).ok).toBe(false);
    expect(validateSkill(null).ok).toBe(false);
  });
});

describe("monthsFor and sizeOf", () => {
  const jobs = [{ id: "a", start_date: "2020-01-01", end_date: "2021-01-01", period_text: null }, { id: "b", start_date: "2018-01-01", end_date: "2019-01-01", period_text: null }];
  const now = new Date("2026-11-16T00:00:00Z");
  it("counts only the linked jobs", () => {
    expect(monthsFor({ jobIds: ["a"] }, jobs, now)).toBe(12);
    expect(monthsFor({ jobIds: ["a", "b"] }, jobs, now)).toBe(24);
    expect(monthsFor({ jobIds: [] }, jobs, now)).toBe(0);
  });
  it("sizes by months", () => expect([0, 12, 36].map(sizeOf)).toEqual(["small", "medium", "large"]));
});

describe("groupSkills", () => {
  it("orders listed categories first, then custom ones, each A to Z", () => {
    const g = groupSkills([sk("Zig", "Zeta"), sk("SQL", "Data"), sk("Go", "Engineering"), sk("Java", "Engineering")]);
    expect(g.map((x) => x.category)).toEqual(["Engineering", "Data", "Zeta"]);
    expect(g[0].skills.map((s) => s.name)).toEqual(["Go", "Java"]);
  });
});

describe("categoryFor", () => {
  it("groups common skills into areas and leaves the rest as Other", () => {
    expect(["SQL", "Power BI", "Statistical Data Analysis", "Python"].map(categoryFor)).toEqual(["Data", "Data", "Data", "Data"]);
    expect(["Docker", "AWS"].map(categoryFor)).toEqual(["Cloud and DevOps", "Cloud and DevOps"]);
    expect(["React", "Java"].map(categoryFor)).toEqual(["Engineering", "Engineering"]);
    expect(["Management Skills", "Change Control", "Communication"].map(categoryFor)).toEqual(["Leadership", "Leadership", "Leadership"]);
    expect(["Analyst", "English"].map(categoryFor)).toEqual(["Other", "Other"]);
  });
});
