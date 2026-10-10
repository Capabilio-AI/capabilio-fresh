import { describe, expect, it } from "vitest";
import { careerPoolTarget } from "@/lib/assess/pool";
import { CAREER_BANK_CAP } from "@/lib/assess/config";
import { canReuseNarrative } from "@/lib/guide-path/generate";
import { newsCacheKey } from "@/lib/pulse/news";

describe("career question bank", () => {
  it("targets add up to at least the cap for any number of skills", () => {
    for (const skills of [1, 7, 16, 23, 40]) {
      const t = careerPoolTarget(skills);
      expect(skills * (t.EASY + t.MEDIUM + t.HARD)).toBeGreaterThanOrEqual(CAREER_BANK_CAP);
    }
  });
});

describe("skill-gap narrative", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  it("is reused inside 30 days for the same career only", () => {
    expect(canReuseNarrative({ target_career: "Data Analyst", generated_at: "2026-10-01T00:00:00Z" }, "Data Analyst", now)).toBe(true);
    expect(canReuseNarrative({ target_career: "Data Analyst", generated_at: "2026-09-01T00:00:00Z" }, "Data Analyst", now)).toBe(false);
    expect(canReuseNarrative({ target_career: "Data Analyst", generated_at: "2026-10-01T00:00:00Z" }, "Cloud Engineer", now)).toBe(false);
    expect(canReuseNarrative(null, "Data Analyst", now)).toBe(false);
  });
});

describe("news cache key", () => {
  it("is the same for the same topic whatever the order or case", () => {
    expect(newsCacheKey(["SQL", "Power BI"])).toBe(newsCacheKey(["power bi", "sql "]));
    expect(newsCacheKey([])).toBe("none");
  });
});
