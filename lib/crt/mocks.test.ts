import { describe, expect, it } from "vitest";
import { MOCKS, mockOf, mockQuestionCount } from "./mocks";
import { drawQuestionIds } from "./server";
import type { CrtModule } from "./model";
import { buildBank } from "./content/bank";

describe("mock blueprints", () => {
  it("each has a unique key and a sensible number of questions (minutes = questions)", () => {
    expect(new Set(MOCKS.map((m) => m.key)).size).toBe(MOCKS.length);
    for (const m of MOCKS) expect(mockQuestionCount(m)).toBeGreaterThanOrEqual(30);
    expect(mockQuestionCount(MOCKS[0])).toBe(60);
  });
  it("looks a mock up by key and returns null for anything else", () => {
    expect(mockOf("quick")?.label).toBe("Quick mock");
    expect(mockOf("nope")).toBeNull();
    expect(mockOf(null)).toBeNull();
  });
});

describe("the question bank can serve every mock", () => {
  it("has at least as many questions in each module as any mock draws, even before the database is imported into", () => {
    const bank = buildBank();
    for (const m of MOCKS) for (const [module, n] of Object.entries(m.counts)) expect(bank.filter((q) => q.module === module).length, `${m.key}/${module}`).toBeGreaterThanOrEqual(n);
  });
});

describe("drawQuestionIds with a per-module blueprint", () => {
  const pool = (["aptitude", "reasoning", "verbal", "soft_skills"] as CrtModule[]).flatMap((m) => Array.from({ length: 30 }, (_, i) => ({ id: `${m}-${i}`, module: m })));
  it("draws exactly the blueprint's count from each module, in module order, and none from a module with 0", () => {
    const ids = drawQuestionIds(pool, new Set(), { aptitude: 5, reasoning: 0, verbal: 3, soft_skills: 2 });
    expect(ids).toHaveLength(10);
    expect(ids.filter((i) => i.startsWith("reasoning"))).toHaveLength(0);
    expect(ids.map((i) => i.split("-")[0])).toEqual([...Array(5).fill("aptitude"), ...Array(3).fill("verbal"), ...Array(2).fill("soft_skills")]);
  });
  it("prefers questions the student has not seen, and a single number still means 'per module'", () => {
    const seen = new Set(pool.filter((q) => q.module === "aptitude").slice(0, 25).map((q) => q.id));
    const ids = drawQuestionIds(pool, seen, { aptitude: 5, reasoning: 0, verbal: 0, soft_skills: 0 });
    expect(ids.every((i) => !seen.has(i))).toBe(true);
    expect(drawQuestionIds(pool, new Set(), 4)).toHaveLength(16);
  });
});
