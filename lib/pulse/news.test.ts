import { describe, expect, it } from "vitest";
import { mergeHits, newsQueries } from "./news";

const hit = (id: string, title: string, url: string | null, points: number, comments = 0) => ({ objectID: id, title, url, points, num_comments: comments, created_at: "2026-10-01T00:00:00Z" });

describe("newsQueries", () => {
  it("prefers specific skill phrases over short role fragments", () => {
    const q = newsQueries({ keywords: [{ term: "ai", weight: 1 }, { term: "machine learning", weight: 0.6 }, { term: "python", weight: 0.6 }, { term: "deep learning", weight: 0.6 }, { term: "statistics", weight: 0.6 }] });
    expect(q).toEqual(["machine learning", "python", "deep learning"]);
  });
  it("is empty without a career", () => expect(newsQueries({ keywords: [] })).toEqual([]));
});

describe("mergeHits", () => {
  it("drops link-less, low-signal and duplicate stories, most discussed first", () => {
    const out = mergeHits([hit("1", "A", "https://a.com/x", 100, 5), hit("2", "B", null, 500), hit("3", "C", "https://c.com", 5), hit("1", "A again", "https://a.com/x", 100, 5), hit("4", "D", "https://www.d.org/p", 80, 60)]);
    expect(out.map((n) => n.id)).toEqual(["4", "1"]);
    expect(out[0].source).toBe("d.org");
  });
});
