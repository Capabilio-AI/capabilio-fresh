import { describe, expect, it } from "vitest";
import { advanceHistory, pickNextChallenge } from "./rotation";

const EMPTY_HISTORY = { recentChallengeIds: [], recentCategories: [] };

describe("pickNextChallenge", () => {
  it("returns null for an empty pool", () => {
    expect(pickNextChallenge([], EMPTY_HISTORY)).toBeNull();
  });

  it("picks the only challenge when the pool has one", () => {
    const pool = [{ id: "a", category: "API" }];
    expect(pickNextChallenge(pool, EMPTY_HISTORY)?.id).toBe("a");
  });

  it("prefers a challenge that is both a different category and not recently completed", () => {
    const pool = [
      { id: "a", category: "API" },
      { id: "b", category: "Database" },
    ];
    const history = { recentChallengeIds: ["a"], recentCategories: ["API"] };
    expect(pickNextChallenge(pool, history)?.id).toBe("b");
  });

  it("falls back to a different category even if it was recently completed, over repeating the same category", () => {
    const pool = [
      { id: "a", category: "API" },
      { id: "b", category: "API" },
      { id: "c", category: "Database" },
    ];
    const history = { recentChallengeIds: ["c"], recentCategories: ["API"] };
    // a and b share category "API" (excluded by recentCategories); c is the
    // only Database option and was just completed, so it's not "unseen" --
    // tier 2 (different category, ignoring recency) still picks c over
    // repeating the API category.
    expect(pickNextChallenge(pool, history)?.category).toBe("Database");
  });

  it("falls back to an unseen challenge when every challenge shares a recently-seen category", () => {
    const pool = [
      { id: "a", category: "API" },
      { id: "b", category: "API" },
    ];
    const history = { recentChallengeIds: ["a"], recentCategories: ["API"] };
    expect(pickNextChallenge(pool, history)?.id).toBe("b");
  });

  it("never returns nothing once the full cycle is exhausted -- resets rather than locking up", () => {
    const pool = [{ id: "a", category: "API" }];
    const history = { recentChallengeIds: ["a"], recentCategories: ["API"] };
    expect(pickNextChallenge(pool, history)?.id).toBe("a");
  });
});

describe("advanceHistory", () => {
  it("prepends the completed challenge and caps the id history at 3", () => {
    const history = { recentChallengeIds: ["a", "b", "c"], recentCategories: [] };
    const next = advanceHistory(history, { id: "d", category: "X" });
    expect(next.recentChallengeIds).toEqual(["d", "a", "b"]);
  });

  it("caps the category history at 4", () => {
    const history = { recentChallengeIds: [], recentCategories: ["A", "B", "C", "D"] };
    const next = advanceHistory(history, { id: "x", category: "E" });
    expect(next.recentCategories).toEqual(["E", "A", "B", "C"]);
  });
});
