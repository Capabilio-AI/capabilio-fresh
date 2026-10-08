import { describe, expect, it } from "vitest";
import { REFRESH_AFTER_DAYS, pickDue } from "./runs";

const NOW = new Date("2026-10-08T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("pickDue", () => {
  it("builds a missing roadmap before refreshing anything", () => {
    expect(pickDue(["a", "b"], [{ career_id: "a", source: "AI_GENERATED", published_at: daysAgo(90) }], NOW)).toEqual({ careerId: "b", reason: "MISSING" });
  });
  it("refreshes the oldest AI roadmap past the refresh date", () => {
    const published = [
      { career_id: "a", source: "AI_GENERATED", published_at: daysAgo(REFRESH_AFTER_DAYS + 5) },
      { career_id: "b", source: "AI_GENERATED", published_at: daysAgo(REFRESH_AFTER_DAYS + 40) },
      { career_id: "c", source: "AI_GENERATED", published_at: daysAgo(3) },
    ];
    expect(pickDue(["a", "b", "c"], published, NOW)).toEqual({ careerId: "b", reason: "STALE" });
  });
  it("leaves a person-authored roadmap alone however old it is", () => {
    expect(pickDue(["a"], [{ career_id: "a", source: "CAPABILIO", published_at: daysAgo(400) }], NOW)).toBeNull();
  });
  it("does nothing when everything is fresh", () => {
    expect(pickDue(["a"], [{ career_id: "a", source: "AI_GENERATED", published_at: daysAgo(1) }], NOW)).toBeNull();
  });
});
