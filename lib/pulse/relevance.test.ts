import { describe, expect, it } from "vitest";
import { buildKeywords, engagementOf, reasonFor, relevance, scoreItem, trendingScore } from "./relevance";

describe("buildKeywords + relevance", () => {
  const kw = buildKeywords(["AI/ML Engineer"], ["Machine Learning", "Python", "SQL"]);
  it("takes role words but never bare job-title words, and weights skills lower", () => {
    expect(kw.find((k) => k.term === "engineer")).toBeUndefined();
    expect(kw.find((k) => k.term === "ai")?.weight).toBe(1);
    expect(kw.find((k) => k.term === "machine learning")?.weight).toBe(0.6);
  });
  it("scores a post by how much of that vocabulary it uses", () => {
    expect(relevance("Trained a Machine Learning model in Python for my AI project", kw)).toBe(1);
    expect(relevance("Our college fest is on Friday", kw)).toBe(0);
    expect(relevance("Learning SQL joins today", kw)).toBeCloseTo(0.3);
  });
  it("matches whole words only", () => {
    expect(relevance("I had a nice chair and a cup of tea", kw)).toBe(0);
  });
  it("no goal means no relevance", () => {
    expect(relevance("anything about ai", [])).toBe(0);
  });
});

describe("scoreItem", () => {
  const base = { ageHours: 10, engagement: 0, relevance: 0, followed: false, page: false, ownCollege: false };
  it("a newer post beats an older one; engagement, a follow, career fit and your college page each lift", () => {
    expect(scoreItem(base)).toBeGreaterThan(scoreItem({ ...base, ageHours: 100 }));
    expect(scoreItem({ ...base, engagement: 10 })).toBeGreaterThan(scoreItem(base));
    expect(scoreItem({ ...base, followed: true })).toBeGreaterThan(scoreItem(base));
    expect(scoreItem({ ...base, relevance: 1 })).toBeGreaterThan(scoreItem(base));
    expect(scoreItem({ ...base, page: true, ownCollege: true })).toBeGreaterThan(scoreItem({ ...base, page: true }));
  });
  it("a followed person's day-old post outranks a stranger's fresh unrelated one", () => {
    expect(scoreItem({ ...base, ageHours: 24, followed: true })).toBeGreaterThan(scoreItem({ ...base, ageHours: 1 }));
  });
});

describe("trendingScore", () => {
  const base = { ageHours: 48, engagement: 0, relevance: 0, followed: false, page: false, ownCollege: false };
  it("engagement dominates age", () => {
    expect(trendingScore({ ...base, ageHours: 140, engagement: 30 })).toBeGreaterThan(trendingScore({ ...base, ageHours: 1, engagement: 1 }));
  });
  it("career fit lifts an equally popular post", () => {
    expect(trendingScore({ ...base, engagement: 5, relevance: 1 })).toBeGreaterThan(trendingScore({ ...base, engagement: 5 }));
  });
});

describe("helpers", () => {
  it("weights comments above likes", () => expect(engagementOf(3, 2)).toBe(7));
  it("explains why a post is shown, most specific first", () => {
    const x = { page: false, followed: false, engagement: 0, relevance: 0, role: "AI/ML Engineer", trending: false };
    expect(reasonFor({ ...x, page: true, orgName: "Amrita Sai" })).toBe("From Amrita Sai");
    expect(reasonFor({ ...x, followed: true })).toBe("From someone you follow");
    expect(reasonFor({ ...x, trending: true, relevance: 0.6 })).toBe("Trending for AI/ML Engineer");
    expect(reasonFor({ ...x, engagement: 6 })).toBe("Trending this week");
    expect(reasonFor({ ...x, relevance: 0.5 })).toBe("For AI/ML Engineer");
    expect(reasonFor(x)).toBeNull();
  });
});
