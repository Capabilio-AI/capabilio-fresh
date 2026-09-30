import { describe, expect, it } from "vitest";
import { pickWeeklyChallengeIds } from "./weekly-batch";

const pool = (ids: string[]) => ids.map((id) => ({ id }));

describe("pickWeeklyChallengeIds", () => {
  it("excludes every challenge the student has already solved", () => {
    const ids = pickWeeklyChallengeIds(pool(["a", "b", "c"]), new Set(["b"]));
    expect(ids).toEqual(["a", "c"]);
  });

  it("never returns more than 8, even with a larger pool", () => {
    const ids = pickWeeklyChallengeIds(
      pool(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]),
      new Set()
    );
    expect(ids).toHaveLength(8);
  });

  it("returns fewer than 8 rather than blocking when the pool minus solved is short", () => {
    const ids = pickWeeklyChallengeIds(pool(["a", "b"]), new Set(["a"]));
    expect(ids).toEqual(["b"]);
  });

  it("returns nothing when every pool challenge has already been solved", () => {
    const ids = pickWeeklyChallengeIds(pool(["a", "b"]), new Set(["a", "b"]));
    expect(ids).toEqual([]);
  });
});
