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

import { addCandidate, matchingExpertise } from "./sidebar";

describe("suggestions", () => {
  it("keeps the strongest reason when someone qualifies twice", () => {
    const m = new Map<string, { reason: string; rank: number }>();
    addCandidate(m, "a", { reason: "Your college", rank: 4 });
    addCandidate(m, "a", { reason: "Your TPO", rank: 0 });
    addCandidate(m, "a", { reason: "Same branch", rank: 3 });
    expect(m.get("a")).toEqual({ reason: "Your TPO", rank: 0 });
  });
  it("matches a mentor's expertise to the career vocabulary in either direction", () => {
    const kw = [{ term: "machine learning" }, { term: "sql" }];
    expect(matchingExpertise(["Interview Prep", "SQL"], kw)).toBe("SQL");
    expect(matchingExpertise(["Machine Learning Ops"], kw)).toBe("Machine Learning Ops");
    expect(matchingExpertise(["Marketing"], kw)).toBeNull();
  });
});
