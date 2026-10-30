import { describe, expect, it } from "vitest";
import { uniqueBy } from "./suggest-skills";

describe("uniqueBy", () => {
  it("keeps the first row per key so a repeated (course, skill) cannot reject the whole insert", () => {
    const rows = [
      { course_id: "c1", skill_id: "s1", confidence: 0.9 },
      { course_id: "c1", skill_id: "s1", confidence: 0.4 },
      { course_id: "c1", skill_id: "s2", confidence: 0.7 },
      { course_id: "c2", skill_id: "s1", confidence: 0.8 },
    ];
    const out = uniqueBy(rows, (r) => `${r.course_id}|${r.skill_id}`);
    expect(out).toHaveLength(3);
    expect(out[0].confidence).toBe(0.9);
  });
});
