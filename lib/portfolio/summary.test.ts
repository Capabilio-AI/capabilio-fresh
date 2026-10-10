import { describe, expect, it } from "vitest";
import { buildPortfolioSummary } from "./summary";

const base = { name: "A", role: "AI/ML Engineer", branch: "AI & ML", college: "Amrita Sai", readiness: 36, skills: [{ name: "Machine Learning", score: 40 }, { name: "Python", score: 19 }, { name: "Statistics", score: 26 }], verifiedChallenges: 2, averageScore: 100, githubVerified: false, githubRepos: null, projects: 0 };

describe("buildPortfolioSummary", () => {
  it("uses only measured facts and never mentions rank or ELO", () => {
    const s = buildPortfolioSummary(base);
    expect(s).toContain("Machine Learning (40%), Statistics (26%) and Python (19%)");
    expect(s).toContain("2 verified work tickets at an average score of 100%");
    expect(s).toMatch(/an AI\/ML Engineer/);
    expect(s).not.toMatch(/ELO|Rookie|tier/i);
  });
  it("is honest when nothing is verified", () => {
    const s = buildPortfolioSummary({ ...base, skills: [], verifiedChallenges: 0, averageScore: null, readiness: null });
    expect(s).toContain("Still building a verified track record");
    expect(s).not.toContain("Strongest");
  });
});
