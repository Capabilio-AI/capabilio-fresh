import { describe, expect, it } from "vitest";
import { buildPortfolioSummary } from "./summary";

const base = { name: "A", branch: "AI & ML", college: "Amrita Sai", skills: [{ name: "Machine Learning", score: 40 }, { name: "Python", score: 19 }, { name: "Statistics", score: 26 }], verifiedChallenges: 2, averageScore: 100, githubVerified: false, githubRepos: null, projects: 0 };

describe("buildPortfolioSummary", () => {
  it("uses only measured facts and never mentions rank or ELO", () => {
    const s = buildPortfolioSummary(base);
    expect(s).toContain("Machine Learning (40%), Statistics (26%) and Python (19%)");
    expect(s).toContain("2 verified work tickets at an average score of 100%");
    expect(s).not.toMatch(/working toward|aspiring|readiness|target|engineer/i);
    expect(s).not.toMatch(/ELO|Rookie|tier/i);
  });
  it("is honest when nothing is verified", () => {
    const s = buildPortfolioSummary({ ...base, skills: [], verifiedChallenges: 0, averageScore: null});
    expect(s).toContain("No verified work on record yet");
    expect(s).not.toContain("Strongest");
  });
});
