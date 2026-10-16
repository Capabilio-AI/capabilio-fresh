import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/workplace/rng";
import { CODE_PROBLEMS } from "@/lib/workplace/code/problems";
import { parsePythonResult } from "@/lib/arena-runtime/client/js-runner";
import { codeTool } from "./code";

const draft = CODE_PROBLEMS.find((p) => p.id === "code-first-unique")!.build(makeRng(3));
const content = draft.content as never;
const key = draft.key as never;
const right = draft.key.expected.map((value) => ({ ok: true, value }));

describe("code tool grading", () => {
  it("passes when every case matches", async () => {
    expect((await codeTool.grade(content, key, { language: "python", outputs: right })).passed).toBe(true);
  });

  it("fails and shows one wrong case, not all of them", async () => {
    const outputs = right.map((o, i) => (i >= 3 ? { ok: true, value: 99 } : o));
    const res = await codeTool.grade(content, key, { language: "javascript", outputs });
    expect(res.passed).toBe(false);
    expect(res.message).toMatch(/cases are wrong/);
    expect(res.message).toContain("but your function gave 99");
  });

  it("fails when a case raised an error, and when cases are missing", async () => {
    expect((await codeTool.grade(content, key, { language: "python", outputs: right.map((o, i) => (i === 0 ? { ok: false, error: "boom" } : o)) })).passed).toBe(false);
    expect((await codeTool.grade(content, key, { language: "python", outputs: right.slice(1) })).passed).toBe(false);
  });

  it("reads Python's JSON, where NaN becomes null", () => {
    expect(parsePythonResult('[{"ok": true, "value": NaN}, {"ok": true, "value": -Infinity}]')).toEqual([{ ok: true, value: null }, { ok: true, value: null }]);
  });

  it("serves a ticket for every area", async () => {
    for (const areaKey of ["fundamentals", "data-structures", "algorithms", "debugging", "rest-api", "auth-and-security", "data-and-state", "error-handling", "backend-debugging"]) {
      process.env.CODE_AI_GENERATION = "off";
      const g = await codeTool.generate({ roleName: "Programming Languages", parentSkill: "Programming", areaName: areaKey, difficulty: "easy", avoidTitles: [], areaKey, ticketSeed: 5, level: "fresher" });
      expect(g.title.length).toBeGreaterThan(8);
    }
  });
});
