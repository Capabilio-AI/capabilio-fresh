import { describe, expect, it } from "vitest";
import { validateBlueprint } from "@/lib/arena-roles/blueprint";
import { IOT_FIRMWARE_ENGINEER } from "@/lib/arena-roles/blueprints/iot-firmware-engineer";
import { TOOLKIT } from "@/lib/arena-roles/toolkit/iot-firmware-engineer";
import { validateToolkit } from "@/lib/arena-roles/toolkit/types";
import { buildCalcChallenge, gradeCalc } from "@/lib/arena-workstations/tools/calc";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import { same } from "../code/compare";
import { IOT_CALC_TEMPLATES } from "../calc/iot";
import type { CalcContent, CalcKey } from "../calc/types";
import { hashSeed, makeRng } from "../rng";
import { templateTiers } from "../tickets/pick";
import { IOT_CODE_PROBLEMS } from "./code-problems";

const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("iot-test", i));
const ALL = [...IOT_CODE_PROBLEMS, ...IOT_CALC_TEMPLATES];
const runJs = (source: string, fn: string, args: unknown[]) => new Function(`${source}\nreturn ${fn};`)()(...structuredClone(args));
const ctx = (areaKey: string, ticketSeed: number): GenerationContext => ({ roleName: "r", parentSkill: "p", areaName: "IoT", difficulty: "easy", avoidTitles: [], areaKey, ticketSeed, level: "fresher" });

describe("IoT Firmware Engineer role", () => {
  it("has a valid blueprint and toolkit, unique iot- area keys, and every area has a fresher easy ticket", () => {
    expect(validateBlueprint(IOT_FIRMWARE_ENGINEER)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    expect(TOOLKIT.roleKey).toBe(IOT_FIRMWARE_ENGINEER.domainRoleKey);
    expect(ALL.length).toBeGreaterThanOrEqual(10);
    expect(IOT_FIRMWARE_ENGINEER.areas.length).toBeGreaterThanOrEqual(5);
    for (const area of IOT_FIRMWARE_ENGINEER.areas) {
      expect(area.areaKey.startsWith("iot-")).toBe(true);
      const own = ALL.filter((t) => t.areas?.includes(area.areaKey));
      expect(own.some((t) => t.difficulty === "easy" && t.minLevel === "fresher"), area.areaKey).toBe(true);
      expect(templateTiers(own, { difficulty: "easy", level: "fresher", areaKey: area.areaKey })[0]?.length, area.areaKey).toBeGreaterThan(0);
    }
    expect(new Set(ALL.map((t) => t.difficulty))).toEqual(new Set(["easy", "medium"]));
  });

  it("states the simulated, client-run limits and lists what is not assessed", () => {
    expect(IOT_FIRMWARE_ENGINEER.limitations.join(" ")).toMatch(/simulated/);
    expect(IOT_FIRMWARE_ENGINEER.limitations.join(" ")).toMatch(/no real MQTT broker/i);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/client-run/);
    expect(IOT_FIRMWARE_ENGINEER.unassessed!.map((u) => u.id)).toEqual(expect.arrayContaining(["iot.broker", "iot.provisioning", "iot.ota-hardware", "iot.security"]));
  });
});

describe("IoT code tickets", () => {
  for (const p of IOT_CODE_PROBLEMS) {
    it(`${p.id}: answers are plain JSON, an empty or all-null answer fails, and a debugging starter is partly right`, () => {
      for (const seed of SEEDS) {
        const d = p.build(makeRng(seed));
        expect(d.content.cases.length).toBeGreaterThanOrEqual(8);
        expect(d.key.expected).toHaveLength(d.content.cases.length);
        expect(JSON.parse(JSON.stringify(d.key.expected))).toEqual(d.key.expected);
        expect(d.key.expected.every((e) => same(e, null))).toBe(false);
        expect(d.key.expected.every((e) => same(e, d.key.expected[0]))).toBe(false);
        if (p.id === "iot-debug-offline-buffer") {
          const got = d.content.cases.map((c) => { try { return runJs(d.content.starters.javascript, d.content.fn, c); } catch { return Symbol("error"); } });
          const right = got.filter((g, i) => same(g, d.key.expected[i])).length;
          expect(right, "broken starter").toBeGreaterThan(0);
          expect(right, "broken starter").toBeLessThan(got.length);
        }
      }
    });
  }
});

describe("IoT calculation tickets", () => {
  for (const t of IOT_CALC_TEMPLATES) {
    it(`${t.id}: the solution passes, wrong or empty fails, and the key stays out of the content`, () => {
      for (const seed of SEEDS) {
        const g = buildCalcChallenge(ctx(t.areas[0], seed), [t]);
        const c = g.content as unknown as CalcContent;
        const key = g.answer_key as unknown as CalcKey;
        const solution = Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));
        expect(gradeCalc(c, key, solution).passed).toBe(true);
        expect(gradeCalc(c, key, {}).passed).toBe(false);
        expect(gradeCalc(c, key, Object.fromEntries(Object.keys(key.expected).map((k) => [k, "0"]))).passed).toBe(false);
        expect(gradeCalc(c, key, Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v * 1.5 + 1)]))).passed).toBe(false);
        expect(JSON.stringify(c)).not.toContain("tolerance");
      }
    });
  }
});
