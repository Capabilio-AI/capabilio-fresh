import { describe, expect, it } from "vitest";
import { buildCalcChallenge, calcTool, gradeCalc } from "@/lib/arena-workstations/tools/calc";
import { GenerationRejected, type GenerationContext } from "@/lib/arena-workstations/types";
import type { CalcContent, CalcKey } from "./types";
import { EXAMPLE_CALC_TEMPLATES } from "./example";

const ctx = (over: Partial<GenerationContext> = {}): GenerationContext => ({ roleName: "r", parentSkill: "p", areaName: "Example", difficulty: "easy", avoidTitles: [], areaKey: "example-area", ticketSeed: 42, level: "fresher", ...over });
const make = (over: Partial<GenerationContext> = {}) => buildCalcChallenge(ctx(over), EXAMPLE_CALC_TEMPLATES);
const solution = (key: CalcKey) => Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));

describe("calc_workspace", () => {
  it("accepts the solution and shows per-check results", () => {
    const g = make();
    const r = gradeCalc(g.content as unknown as CalcContent, g.answer_key as unknown as CalcKey, solution(g.answer_key as unknown as CalcKey));
    expect(r.passed).toBe(true);
    expect(r.checks.length).toBe(2);
  });

  it("accepts a value inside tolerance and rejects one outside", () => {
    const g = make();
    const key = g.answer_key as unknown as CalcKey;
    const s = solution(key);
    const near = { ...s, current: String(key.expected.current * 1.01) };
    const far = { ...s, current: String(key.expected.current * 1.2) };
    expect(gradeCalc(g.content as unknown as CalcContent, key, near).passed).toBe(true);
    expect(gradeCalc(g.content as unknown as CalcContent, key, far).checks.map((c) => c.passed)).toEqual([false, true]);
  });

  it("fails blank and wrong submissions", () => {
    const g = make();
    const c = g.content as unknown as CalcContent;
    const key = g.answer_key as unknown as CalcKey;
    expect(gradeCalc(c, key, {}).passed).toBe(false);
    expect(gradeCalc(c, key, { current: "abc", power: "" }).passed).toBe(false);
    expect(gradeCalc(c, key, { current: "0", power: "0" }).passed).toBe(false);
  });

  it("never puts the key in the content", () => {
    const g = make();
    const text = JSON.stringify(g.content);
    expect(text).not.toContain("expected");
    expect(text).not.toContain("tolerance");
    for (const v of Object.values((g.answer_key as unknown as CalcKey).expected)) expect(text).not.toContain(String(v));
    expect((g.content as unknown as CalcContent).maxSubmissions).toBe(5);
  });

  it("is deterministic per ticketSeed", () => {
    expect(make({ ticketSeed: 7 })).toEqual(make({ ticketSeed: 7 }));
    const keys = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(make({ ticketSeed: s }).answer_key)));
    expect(keys.size).toBeGreaterThan(1);
  });

  it("throws GenerationRejected for an area with no template", async () => {
    expect(() => make({ areaKey: "nope" })).toThrow(GenerationRejected);
    await expect(calcTool.generate(ctx())).rejects.toThrow(GenerationRejected); // the example set is not served
  });

  it("validates the submission schema", () => {
    expect(calcTool.submissionSchema.safeParse({ answers: { a: "1" } }).success).toBe(true);
    expect(calcTool.submissionSchema.safeParse({ answers: { a: "x".repeat(41) } }).success).toBe(false);
    expect(calcTool.submissionSchema.safeParse({}).success).toBe(false);
  });
});
