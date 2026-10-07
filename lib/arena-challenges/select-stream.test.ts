import { describe, expect, it } from "vitest";
import { BATCH_SIZE, selectStreamBatch, targetMix, tierFor, type StreamCandidate, type StreamSelectionInput } from "./select-stream";

const cand = (id: string, difficulty: string, category = "general", courseTags: string[] = []): StreamCandidate => ({ id, difficulty, category, courseTags });
const base = (over: Partial<StreamSelectionInput>): StreamSelectionInput => ({ pool: [], solvedIds: new Set(), recentIds: new Set(), courses: [], currentYear: null, points: 0, seed: "u1:2026-10-05", ...over });
const many = (n: number, difficulty: string) => Array.from({ length: n }, (_, i) => cand(`${difficulty}${i}`, difficulty, `c${i % 3}`));

describe("tierFor", () => {
  const courses = [{ title: "Strength of Materials", year: 2 }, { title: "Surveying", year: 1 }, { title: "Concrete Technology", year: 4 }];
  it("matches a challenge to the course taught this year", () => expect(tierFor(cand("a", "easy", "x", ["strength of materials"]), courses, 2)).toBe("CURRENT_YEAR"));
  it("treats a neighbouring year as adjacent", () => expect(tierFor(cand("a", "easy", "x", ["Surveying"]), courses, 2)).toBe("ADJACENT_YEAR"));
  it("treats a far-off or unmatched subject as general", () => {
    expect(tierFor(cand("a", "easy", "x", ["Concrete Technology"]), courses, 2)).toBe("GENERAL");
    expect(tierFor(cand("a", "easy", "x", ["Thermodynamics"]), courses, 2)).toBe("GENERAL");
  });
  it("is general when no curriculum or year is known", () => {
    expect(tierFor(cand("a", "easy", "x", ["Surveying"]), [], 2)).toBe("GENERAL");
    expect(tierFor(cand("a", "easy", "x", ["Surveying"]), courses, null)).toBe("GENERAL");
  });
});

describe("selectStreamBatch", () => {
  it("never returns more than 8, and never an already solved challenge", () => {
    const pool = [...many(6, "easy"), ...many(6, "medium"), ...many(6, "hard")];
    const out = selectStreamBatch(base({ pool, solvedIds: new Set(["easy0"]) }));
    expect(out.ids).toHaveLength(BATCH_SIZE);
    expect(out.ids).not.toContain("easy0");
    expect(out.shortfall).toBe(0);
  });

  it("is deterministic for the same seed and varies with it", () => {
    const pool = [...many(8, "easy"), ...many(8, "medium"), ...many(8, "hard")];
    const a = selectStreamBatch(base({ pool }));
    expect(selectStreamBatch(base({ pool })).ids).toEqual(a.ids);
    expect(selectStreamBatch(base({ pool, seed: "u1:2026-10-12" })).ids).not.toEqual(a.ids);
  });

  it("puts current-year subjects ahead of general fundamentals", () => {
    const courses = [{ title: "Fluid Mechanics", year: 2 }];
    const pool = [...many(10, "easy"), cand("fm", "easy", "fluids", ["Fluid Mechanics"])];
    const out = selectStreamBatch(base({ pool, courses, currentYear: 2, points: 0 }));
    expect(out.tiers.fm).toBe("CURRENT_YEAR");
    expect(out.ids).toContain("fm");
  });

  it("ranks recently served challenges last but still uses them when the pool is short", () => {
    const short = [cand("old", "easy", "a"), cand("new1", "easy", "b"), cand("new2", "easy", "c")];
    expect(selectStreamBatch(base({ pool: short, recentIds: new Set(["old"]) })).ids.sort()).toEqual(["new1", "new2", "old"]);
    const full = [...many(8, "easy"), cand("old", "easy", "z")];
    expect(selectStreamBatch(base({ pool: full, recentIds: new Set(["old"]) })).ids).not.toContain("old");
  });

  it("follows the difficulty mix for the student's points", () => {
    const pool = [...many(8, "easy"), ...many(8, "medium"), ...many(8, "hard")];
    const count = (points: number) => {
      const out = selectStreamBatch(base({ pool, points }));
      return ["easy", "medium", "hard"].map((d) => out.ids.filter((id) => id.startsWith(d)).length);
    };
    for (const points of [0, 200, 500]) {
      const m = targetMix(points);
      expect(count(points)).toEqual([m.easy, m.medium, m.hard]);
    }
  });

  it("spreads across subjects", () => {
    const pool = [cand("a1", "easy", "A"), cand("a2", "easy", "A"), cand("a3", "easy", "A"), cand("b1", "easy", "B"), cand("c1", "easy", "C"), cand("d1", "easy", "D")];
    const out = selectStreamBatch(base({ pool }));
    expect(new Set(out.ids.slice(0, 4).map((id) => id[0])).size).toBe(4);
  });

  it("reports a shortfall instead of padding when little is published", () => {
    const out = selectStreamBatch(base({ pool: [cand("a", "easy"), cand("b", "hard")] }));
    expect(out.ids).toHaveLength(2);
    expect(out.shortfall).toBe(6);
  });

  it("returns nothing for an empty pool", () => {
    expect(selectStreamBatch(base({}))).toMatchObject({ ids: [], shortfall: BATCH_SIZE });
  });
});
