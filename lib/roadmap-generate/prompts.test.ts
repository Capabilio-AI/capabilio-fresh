import { describe, expect, it } from "vitest";
import { demandTier, extrasPrompt, extrasTargets, roadmapPrompt } from "./prompts";

const career = { name: "Data Analyst", description: null, category: null };

describe("extrasTargets", () => {
  it("gives a bigger role more projects and certifications, within sensible bounds", () => {
    expect(extrasTargets(12).projects[0]).toBe(6);
    expect(extrasTargets(24).projects[0]).toBe(8);
    expect(extrasTargets(80).projects[0]).toBe(14);
    expect(extrasTargets(12).certifications[0]).toBe(4);
    expect(extrasTargets(80).certifications[0]).toBe(8);
  });
});

describe("prompts", () => {
  it("lets the role set the number of skills instead of a fixed range", () => {
    const text = roadmapPrompt({ career, skills: [{ name: "SQL", category: "Data" }] });
    expect(text).toMatch(/job postings/);
    expect(text).toMatch(/EVERY skill/);
    expect(text).not.toMatch(/20-60/);
  });
  it("sizes the project and certification ask to the roadmap", () => {
    const names = Array.from({ length: 24 }, (_, i) => `Skill ${i}`);
    expect(extrasPrompt({ career, skillNames: names })).toMatch(/8 to 10 projects/);
  });
});

describe("marketBlock", () => {
  const snap = (over = {}) => ({ role: "Data Analyst", fetchedAt: "2026-11-10T00:00:00Z", sampled: 150, topSkills: [{ skillId: "a", name: "SQL", postings: 90, share: 0.6 }, { skillId: "b", name: "Tableau", postings: 1, share: 0.007 }], titles: [], companies: [], locations: [], salary: null, jobs: [], ...over });
  it("puts demand numbers into the roadmap prompt", () => {
    const text = roadmapPrompt({ career, skills: [], market: snap() });
    expect(text).toMatch(/150 current job postings/);
    expect(text).toMatch(/SQL: 60% of postings, CORE/);
    expect(text).not.toMatch(/Tableau/); // seen once is noise
  });
  it("adds nothing without enough postings", () => {
    expect(roadmapPrompt({ career, skills: [], market: snap({ sampled: 4 }) })).not.toMatch(/LIVE MARKET/);
    expect(roadmapPrompt({ career, skills: [] })).not.toMatch(/LIVE MARKET/);
  });
});

describe("demandTier", () => {
  it("judges demand against the most requested skill, since snippets understate every share", () => {
    // real Data Analyst postings: SQL 20%, Python 16%, Excel 10%, Power BI 6%, a rare tool 2%
    expect(demandTier(0.2, 0.2)).toBe("CORE");
    expect(demandTier(0.16, 0.2)).toBe("CORE");
    expect(demandTier(0.1, 0.2)).toBe("CORE");
    expect(demandTier(0.06, 0.2)).toBe("RECOMMENDED");
    expect(demandTier(0.02, 0.2)).toBe("OPTIONAL");
  });
  it("still treats a high absolute share as core when the top skill is small", () => {
    expect(demandTier(0.16, 0.16)).toBe("CORE");
  });
});
