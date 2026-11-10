import { describe, expect, it } from "vitest";
import { resultsCsv, summarizeCycle, type ResultRow } from "./aggregate";
import type { ModuleScores } from "./model";

const scores = (a: number, r: number, v: number, s: number): ModuleScores => ({
  aptitude: { points: a, max: 10 },
  reasoning: { points: r, max: 10 },
  verbal: { points: v, max: 10 },
  soft_skills: { points: s, max: 10 },
});
const done = (id: string, branch: string | null, total: number, ms: ModuleScores): ResultRow => ({ userId: id, name: id, branch, totalPct: total, moduleScores: ms, started: true });

describe("summarizeCycle", () => {
  it("counts participation against the eligible students and finds the weakest module", () => {
    const rows = [done("a", "CSE", 70, scores(9, 8, 7, 4)), done("b", "CSE", 50, scores(5, 5, 5, 5)), done("c", "ECE", 30, scores(3, 3, 3, 3)), { userId: "d", name: "d", branch: "ECE", totalPct: null, moduleScores: null, started: true }];
    const s = summarizeCycle(rows, 10);
    expect(s).toMatchObject({ eligible: 10, started: 4, submitted: 3, participationPct: 30, avgPct: 50 });
    expect(s.moduleAvg.aptitude).toBe(56.7);
    expect(s.weakest).toBe("soft_skills");
    expect(s.bands).toEqual({ needs_work: 1, developing: 1, proficient: 1, strong: 0 });
    expect(s.byBranch).toEqual([{ branch: "CSE", submitted: 2, avgPct: 60 }, { branch: "ECE", submitted: 1, avgPct: 30 }]);
  });

  it("is safe with nobody eligible or nobody finished", () => {
    const s = summarizeCycle([], 0);
    expect(s).toMatchObject({ participationPct: 0, avgPct: null, weakest: null, submitted: 0 });
  });
});

describe("resultsCsv", () => {
  it("writes every student, marks non-takers, and defuses formulas", () => {
    const csv = resultsCsv([
      { ...done("=cmd", "CSE", 80, scores(8, 8, 8, 8)), name: '=HYPERLINK("x")', rollNumber: "21A" },
      { userId: "n", name: "Nina, K", branch: null, totalPct: null, moduleScores: null, started: false },
    ]).split("\n");
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv[1]).toContain("Completed");
    expect(csv[1]).toContain("strong");
    expect(csv[2]).toBe('"Nina, K",,,,Not started,,,,,,');
  });
});
