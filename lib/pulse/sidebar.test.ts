import { describe, expect, it } from "vitest";
import { rankTags } from "./sidebar";

describe("rankTags", () => {
  it("counts a tag once per post and ranks by use, then name", () => {
    const out = rankTags(["#sql #SQL basics", "learning #sql and #python", "#python tips", "#rust", "no tags"]);
    expect(out).toEqual([{ tag: "python", posts: 2 }, { tag: "sql", posts: 2 }, { tag: "rust", posts: 1 }]);
  });
  it("respects the limit", () => {
    expect(rankTags(["#aa #bb #cc"], 2)).toHaveLength(2);
  });
});
