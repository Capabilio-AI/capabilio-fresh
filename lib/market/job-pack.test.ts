import { describe, expect, it } from "vitest";
import { JobPackSchema, jobPackPrompt } from "./job-pack";

describe("jobPackPrompt", () => {
  it("names the role and its skills, and uses market evidence only when there is some", () => {
    const base = jobPackPrompt("Data Analyst", ["SQL", "Excel"], null);
    expect(base).toContain("Data Analyst");
    expect(base).toContain("SQL; Excel");
    expect(base).not.toMatch(/current postings/);
    const market = { role: "x", fetchedAt: "", sampled: 100, topSkills: [{ skillId: "a", name: "Power BI", postings: 40, share: 0.4 }], titles: [{ name: "Junior Data Analyst", postings: 9 }], companies: [], locations: [], salary: null, jobs: [] };
    const withMarket = jobPackPrompt("Data Analyst", ["SQL"], market);
    expect(withMarket).toContain("Power BI");
    expect(withMarket).toContain("Junior Data Analyst");
  });
});

describe("JobPackSchema", () => {
  const list = (n: number, s = "A reasonable sentence here") => Array.from({ length: n }, () => s);
  it("accepts a complete pack and rejects a thin one", () => {
    const ok = { interviewTopics: Array.from({ length: 6 }, () => ({ topic: "Joins", why: "Comes up in every screen", skills: ["SQL"] })), practiceQuestions: list(8), resumeChecklist: list(6), portfolioChecklist: list(4) };
    expect(JobPackSchema.safeParse(ok).success).toBe(true);
    expect(JobPackSchema.safeParse({ ...ok, resumeChecklist: list(2) }).success).toBe(false);
  });
});
