import { describe, expect, it } from "vitest";
import { validateBlueprint } from "@/lib/arena-roles/blueprint";
import { EMBEDDED_SYSTEMS_ENGINEER } from "@/lib/arena-roles/blueprints/embedded-systems-engineer";
import { TOOLKIT } from "@/lib/arena-roles/toolkit/embedded-systems-engineer";
import { validateToolkit } from "@/lib/arena-roles/toolkit/types";
import { buildCalcChallenge, gradeCalc } from "@/lib/arena-workstations/tools/calc";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import { same } from "../code/compare";
import { EMBEDDED_CALC_TEMPLATES } from "../calc/embedded";
import type { CalcContent, CalcKey } from "../calc/types";
import { hashSeed, makeRng } from "../rng";
import { templateTiers } from "../tickets/pick";
import { EMBEDDED_CODE_PROBLEMS } from "./code-problems";

const ALL = [...EMBEDDED_CODE_PROBLEMS, ...EMBEDDED_CALC_TEMPLATES];
const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("emb-test", i));
const runJs = (source: string, fn: string, args: unknown[]) => new Function(`${source}\nreturn ${fn};`)()(...structuredClone(args));
const ctx = (areaKey: string, ticketSeed: number): GenerationContext => ({ roleName: "r", parentSkill: "p", areaName: "Area", difficulty: "easy", avoidTitles: [], areaKey, ticketSeed, level: "fresher" });

describe("Embedded Systems Engineer role", () => {
  it("has a valid blueprint and toolkit, and every area has a fresher easy ticket", () => {
    expect(validateBlueprint(EMBEDDED_SYSTEMS_ENGINEER)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    expect(TOOLKIT.roleKey).toBe(EMBEDDED_SYSTEMS_ENGINEER.domainRoleKey);
    expect(ALL.length).toBeGreaterThanOrEqual(10);
    expect(EMBEDDED_SYSTEMS_ENGINEER.areas.length).toBeGreaterThanOrEqual(5);
    for (const area of EMBEDDED_SYSTEMS_ENGINEER.areas) {
      expect(area.areaKey.startsWith("emb-")).toBe(true);
      const own = ALL.filter((t) => t.areas?.includes(area.areaKey));
      expect(own.some((t) => t.difficulty === "easy" && t.minLevel === "fresher"), area.areaKey).toBe(true);
      expect(templateTiers(own, { difficulty: "easy", level: "fresher", areaKey: area.areaKey })[0]?.length, area.areaKey).toBeGreaterThan(0);
    }
    expect(new Set(ALL.map((t) => t.difficulty))).toEqual(new Set(["easy", "medium"]));
    expect(new Set(ALL.map((t) => t.id)).size).toBe(ALL.length);
  });

  it("says the firmware is simulated and lists real tooling as unassessed", () => {
    expect(EMBEDDED_SYSTEMS_ENGINEER.limitations.join(" ")).toMatch(/simulated/);
    expect(EMBEDDED_SYSTEMS_ENGINEER.limitations.join(" ")).toMatch(/not a real microcontroller/);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/client-run/);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/simulated/);
    expect(EMBEDDED_SYSTEMS_ENGINEER.unassessed!.map((u) => u.id)).toEqual(expect.arrayContaining(["emb.ide", "emb.registers", "emb.rtos", "emb.hw-debug"]));
  });
});

describe("Embedded code tickets", () => {
  for (const p of EMBEDDED_CODE_PROBLEMS) {
    it(`${p.id}: answers are plain JSON, an empty submission fails, and a debugging starter is partly right`, () => {
      for (const seed of SEEDS) {
        const d = p.build(makeRng(seed));
        expect(d.content.cases.length).toBeGreaterThanOrEqual(8);
        expect(d.key.expected).toHaveLength(d.content.cases.length);
        expect(JSON.parse(JSON.stringify(d.key.expected))).toEqual(d.key.expected);
        expect(d.key.expected.every((e) => same(e, null))).toBe(false);
        // a starter that returns nothing must not pass the hidden cases
        expect(d.key.expected.every((e) => same(e, undefined))).toBe(false);
        if (p.id.includes("debug")) {
          const got = d.content.cases.map((c) => { try { return runJs(d.content.starters.javascript, d.content.fn, c); } catch { return Symbol("error"); } });
          const right = got.filter((g, i) => same(g, d.key.expected[i])).length;
          expect(right, `${p.id} broken starter`).toBeGreaterThan(0);
          expect(right, `${p.id} broken starter`).toBeLessThan(got.length);
        }
      }
    });
  }

  it("produces the traces the spec describes (hand-checked reference cases)", () => {
    const exp = (id: string) => EMBEDDED_CODE_PROBLEMS.find((p) => p.id === id)!.build(makeRng(1)).key.expected;
    expect(exp("emb-debounce-button")[0]).toEqual([0, 0, 0, 1, 1, 1, 1, 0, 0]);
    expect(exp("emb-led-modes")[0]).toEqual([0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
    expect(exp("emb-adc-to-tenths")[0]).toEqual([0, 3296, 1650]);
    expect(exp("emb-build-frame")[0]).toEqual([170, 3, 1, 2, 3, 3]);
    expect(exp("emb-parse-frames")[0]).toEqual([[7, 9]]);
    expect(exp("emb-parse-frames")[3]).toEqual([[5]]);
    expect(exp("emb-debug-millis-elapsed").slice(0, 4)).toEqual([500, 496, 0, 1]);
    expect(exp("emb-pwm-levels")[0]).toEqual([1, 1, 0, 0, 1, 1, 0, 0]);
  });
});

describe("Embedded circuit calculations", () => {
  for (const t of EMBEDDED_CALC_TEMPLATES) {
    it(`${t.id}: the solution passes, and empty, zero and wrong answers fail`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const g = buildCalcChallenge(ctx(t.areas[0], seed), [t]);
        const c = g.content as unknown as CalcContent;
        const key = g.answer_key as unknown as CalcKey;
        const sol = Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));
        expect(gradeCalc(c, key, sol).passed, `seed ${seed}`).toBe(true);
        expect(gradeCalc(c, key, {}).passed).toBe(false);
        expect(gradeCalc(c, key, Object.fromEntries(Object.keys(sol).map((k) => [k, "0"]))).passed).toBe(false);
        expect(gradeCalc(c, key, Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v * 1.5 + 1)]))).passed).toBe(false);
        expect(JSON.stringify(c)).not.toContain("tolerance");
      }
    });
  }
});
