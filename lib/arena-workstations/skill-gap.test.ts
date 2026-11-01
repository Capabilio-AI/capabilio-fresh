import { describe, expect, it } from "vitest";
import { areaNeed, priorityByNeed, type SkillNeed } from "./skill-gap";

const skills = new Map<string, SkillNeed>([
  ["py", { weight: 4, target: 85, score: null }], // critical, unproven
  ["ml", { weight: 4, target: 85, score: 55 }],
  ["sql", { weight: 3, target: 70, score: 70 }], // at target
]);

describe("skill-gap priorities", () => {
  it("counts an unproven skill as zero and a skill at target as no need", () => {
    expect(areaNeed(["py"], skills)).toBe(340);
    expect(areaNeed(["sql"], skills)).toBe(0);
  });

  it("serves the area that closes the most gap first (lowest priority value)", () => {
    const p = priorityByNeed([{ areaKey: "a-py", skillIds: ["py"] }, { areaKey: "a-ml", skillIds: ["ml"] }, { areaKey: "a-sql", skillIds: ["sql"] }, { areaKey: "a-none", skillIds: [] }], skills)!;
    const order = Object.keys(p).sort((a, b) => p[a] - p[b]);
    expect(order.slice(0, 2)).toEqual(["a-py", "a-ml"]);
    expect(p["a-none"]).toBe(0);
  });

  it("an area proving two needy skills outranks one proving a single skill", () => {
    const p = priorityByNeed([{ areaKey: "one", skillIds: ["ml"] }, { areaKey: "two", skillIds: ["ml", "py"] }], skills)!;
    expect(p.two).toBeLessThan(p.one);
  });

  it("does not double count a skill listed twice for one area", () => {
    expect(areaNeed(["py", "py"], skills)).toBe(areaNeed(["py"], skills));
  });

  it("returns undefined when no area proves a known skill, so the caller keeps rating order", () => {
    expect(priorityByNeed([{ areaKey: "x", skillIds: ["unknown"] }], skills)).toBeUndefined();
  });
});
