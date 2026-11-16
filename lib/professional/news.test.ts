import { describe, expect, it } from "vitest";
import { mergeHits, newsQueries } from "./news-rules";

describe("newsQueries", () => {
  it("uses distinct, specific skills, at most three", () => {
    expect(newsQueries(["Python", "python", "SQL", "Go", "Kafka", "Spark"])).toEqual(["python", "sql", "kafka"]);
  });
  it("is empty without usable skills", () => expect(newsQueries(["C", " "])).toEqual([]));
});

describe("mergeHits", () => {
  const h = (id: string, url: string | null, points: number, comments = 0) => ({ objectID: id, title: `Story ${id}`, url, points, num_comments: comments });
  it("drops link-less, low-signal and repeated stories and sorts by discussion", () => {
    const out = mergeHits([h("1", "https://a.com/x", 40, 0), h("2", null, 500), h("3", "https://b.com/y", 29), h("4", "https://c.com/z", 35, 50), h("1", "https://a.com/x", 40), h("5", "https://a.com/x", 90)]);
    expect(out.map((x) => x.id)).toEqual(["4", "5"]);
    expect(out[0].source).toBe("c.com");
  });
  it("refuses a javascript link", () => expect(mergeHits([h("1", "javascript:alert(1)", 100)])).toEqual([]));
});
