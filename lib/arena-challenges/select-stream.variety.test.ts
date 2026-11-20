import { describe, expect, it } from "vitest";
import { selectStreamBatch, type StreamCandidate } from "./select-stream";

const mission = (id: string, category: string, difficulty = "easy"): StreamCandidate => ({ id, difficulty, category, courseTags: [], kind: "mission" });
const base = { solvedIds: new Set<string>(), recentIds: new Set<string>(), courses: [], currentYear: 2, points: 0, seed: "u:w", year: 2 };

describe("selectStreamBatch variety", () => {
  it("serves each simulator concept once in a week, even when one concept has many variants", () => {
    const pool = [...["a1", "a2", "a3"].map((id) => mission(id, "Circuits")), ...["b1", "b2"].map((id) => mission(id, "Trusses")), mission("c1", "Hydraulics")];
    const { ids } = selectStreamBatch({ ...base, pool, size: 3 });
    const cats = ids.map((id) => pool.find((c) => c.id === id)!.category);
    expect(new Set(cats).size).toBe(3);
  });

  it("brings a concept back only when the board would otherwise be short", () => {
    const pool = [mission("a1", "Circuits"), mission("a2", "Circuits"), mission("b1", "Trusses")];
    const { ids, shortfall } = selectStreamBatch({ ...base, pool, size: 3 });
    expect(ids).toHaveLength(3);
    expect(shortfall).toBe(0);
  });

  it("ranks a concept the student has not met before one they have", () => {
    const pool = [mission("a1", "Circuits"), mission("b1", "Trusses"), mission("c1", "Hydraulics")];
    const { ids } = selectStreamBatch({ ...base, pool, size: 2, seenConcepts: new Set(["Circuits", "Trusses"]) });
    expect(ids).toContain("c1");
  });

  it("never re-serves a challenge from an earlier week while anything new remains", () => {
    const pool = [mission("old", "Circuits"), mission("new1", "Trusses"), mission("new2", "Hydraulics")];
    const { ids } = selectStreamBatch({ ...base, pool, size: 2, recentIds: new Set(["old"]) });
    expect(ids).not.toContain("old");
  });

  it("never serves a solved challenge", () => {
    const pool = [mission("done", "Circuits"), mission("x", "Trusses")];
    const { ids } = selectStreamBatch({ ...base, pool, size: 2, solvedIds: new Set(["done"]) });
    expect(ids).toEqual(["x"]);
  });
});
