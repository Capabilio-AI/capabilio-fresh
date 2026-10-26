import { describe, expect, it } from "vitest";
import { validateBlueprint } from "@/lib/arena-roles/blueprint";
import { PLC_AUTOMATION_ENGINEER } from "@/lib/arena-roles/blueprints/plc-automation-engineer";
import { TOOLKIT } from "@/lib/arena-roles/toolkit/plc-automation-engineer";
import { validateToolkit } from "@/lib/arena-roles/toolkit/types";
import { buildCalcChallenge, gradeCalc } from "@/lib/arena-workstations/tools/calc";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import { same } from "../code/compare";
import type { CalcContent, CalcKey } from "../calc/types";
import { PLC_CALC_TEMPLATES } from "../calc/plc";
import { hashSeed, makeRng } from "../rng";
import { templateTiers } from "../tickets/pick";
import { PLC_CODE_PROBLEMS } from "./code-problems";

const ALL = [...PLC_CODE_PROBLEMS, ...PLC_CALC_TEMPLATES];
const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("plc-test", i));
const runJs = (source: string, args: unknown[]) => new Function(`${source}\nreturn scan;`)()(...structuredClone(args));

/** independent JavaScript solutions, written from each ticket's deliverable text and not from the reference code */
const SOLUTIONS: Record<string, string> = {
  "plc-seal-in-start-stop": `function scan(inputs, state) {
    const run = !inputs.stop && !inputs.estop && (inputs.start || state.run);
    return { outputs: { motor: run }, state: { run } };
  }`,
  "plc-fwd-rev-interlock": `function scan(inputs, state) {
    let dir = state.dir;
    if (inputs.stop || inputs.estop) dir = "none";
    else if (dir === "none") {
      if (inputs.fwd_btn && !inputs.rev_btn) dir = "fwd";
      else if (inputs.rev_btn && !inputs.fwd_btn) dir = "rev";
    }
    return { outputs: { fwd: dir === "fwd", rev: dir === "rev" }, state: { dir } };
  }`,
  "plc-on-delay-timer": `function scan(inputs, state) {
    const acc = inputs.enable ? Math.min(state.acc + 1, 5) : 0;
    return { outputs: { done: acc === 5 }, state: { acc } };
  }`,
  "plc-ctu-box-counter": `function scan(inputs, state) {
    let count = state.count;
    if (inputs.reset) count = 0;
    else if (inputs.pulse && !state.prev) count += 1;
    return { outputs: { count, done: count >= 4 }, state: { count, prev: inputs.pulse } };
  }`,
  "plc-tank-fill-pump": `function scan(inputs, state) {
    let pump = state.pump;
    if (inputs.low) pump = true;
    else if (inputs.high) pump = false;
    return { outputs: { pump }, state: { pump } };
  }`,
  "plc-conveyor-stop-and-clamp": `function scan(inputs, state) {
    let { step, acc } = state;
    if (inputs.estop) { step = "idle"; acc = 0; }
    else if (step === "idle") { if (inputs.start) step = "run"; }
    else if (step === "run") { if (inputs.part_at_end) { step = "dwell"; acc = 0; } }
    else { acc += 1; if (acc >= 3) { step = "idle"; acc = 0; } }
    return { outputs: { conveyor: step === "run", clamp: step === "dwell" }, state: { step, acc } };
  }`,
  "plc-traffic-light-phases": `function scan(inputs, state) {
    const len = { green: 4, yellow: 2, red: 5 };
    const next = { green: "yellow", yellow: "red", red: "green" };
    let { phase, acc } = state;
    if (!inputs.hold) acc += 1;
    if (acc >= len[phase]) { phase = next[phase]; acc = 0; }
    return { outputs: { green: phase === "green", yellow: phase === "yellow", red: phase === "red" }, state: { phase, acc } };
  }`,
  "plc-debounce-fault": `function scan(inputs, state) {
    const count = inputs.sensor ? state.count + 1 : 0;
    return { outputs: { fault: count >= 3 }, state: { count } };
  }`,
  "plc-alarm-latch-failsafe": `function scan(inputs, state) {
    const alarm = !inputs.sensor_ok || inputs.pressure_high || (state.alarm && !inputs.ack);
    return { outputs: { alarm, valve_open: !alarm }, state: { alarm } };
  }`,
  "plc-debug-estop-latch": `function scan(inputs, state) {
    const tripped = inputs.estop || (state.tripped && !inputs.reset);
    return { outputs: { run: !tripped }, state: { tripped } };
  }`,
};

const ctx = (areaKey: string, seed: number): GenerationContext => ({ roleName: "PLC", parentSkill: "Industrial Automation", areaName: "x", difficulty: "easy", avoidTitles: [], areaKey, ticketSeed: seed, level: "fresher" });
const asCalc = (t: ReturnType<typeof buildCalcChallenge>) => ({ content: t.content as unknown as CalcContent, key: t.answer_key as unknown as CalcKey });

describe("PLC Automation Engineer role", () => {
  it("has a valid blueprint and toolkit, and every area has a fresher easy ticket", () => {
    expect(validateBlueprint(PLC_AUTOMATION_ENGINEER)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    expect(TOOLKIT.roleKey).toBe(PLC_AUTOMATION_ENGINEER.domainRoleKey);
    expect(ALL.length).toBeGreaterThanOrEqual(10);
    expect(PLC_AUTOMATION_ENGINEER.areas.length).toBeGreaterThanOrEqual(5);
    for (const area of PLC_AUTOMATION_ENGINEER.areas) {
      expect(area.areaKey.startsWith("plc-")).toBe(true);
      const own = ALL.filter((t) => t.areas?.includes(area.areaKey));
      expect(own.some((t) => t.difficulty === "easy" && t.minLevel === "fresher"), area.areaKey).toBe(true);
      expect(templateTiers(own, { difficulty: "easy", level: "fresher", areaKey: area.areaKey })[0]?.length, area.areaKey).toBeGreaterThan(0);
    }
    expect(new Set(ALL.map((t) => t.difficulty))).toEqual(new Set(["easy", "medium"]));
  });

  it("states that the logic is simulated and what is not assessed", () => {
    expect(PLC_AUTOMATION_ENGINEER.limitations.join(" ")).toMatch(/simulated/);
    expect(PLC_AUTOMATION_ENGINEER.limitations.join(" ")).toMatch(/not TIA Portal/);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/simulated/);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/client-run/);
    expect(TOOLKIT.honestLimits.join(" ")).toMatch(/safety/);
    expect(PLC_AUTOMATION_ENGINEER.unassessed!.map((u) => u.id)).toEqual(expect.arrayContaining(["plc.ladder", "plc.hmi", "plc.io", "plc.safety"]));
  });
});

describe("PLC code tickets", () => {
  it("has a solution for every ticket", () => {
    expect(Object.keys(SOLUTIONS).sort()).toEqual(PLC_CODE_PROBLEMS.map((p) => p.id).sort());
  });

  for (const p of PLC_CODE_PROBLEMS) {
    it(`${p.id}: an independent solution passes every case, an empty or all-null answer fails, and the debugging starter is partly right`, () => {
      for (const seed of SEEDS) {
        const d = p.build(makeRng(seed));
        expect(d.content.cases.length).toBeGreaterThanOrEqual(8);
        expect(d.key.expected).toHaveLength(d.content.cases.length);
        expect(JSON.parse(JSON.stringify(d.key.expected))).toEqual(d.key.expected);
        expect(d.key.expected.every((e) => same(e, null))).toBe(false);
        // deterministic per seed
        expect(p.build(makeRng(seed))).toEqual(d);
        const got = d.content.cases.map((c) => runJs(SOLUTIONS[p.id], c));
        expect(got.every((g, i) => same(g, d.key.expected[i])), `${p.id} solution`).toBe(true);
        // the starter returns nothing (or, for a debugging ticket, something partly right)
        const starterGot = d.content.cases.map((c) => { try { return runJs(d.content.starters.javascript, c); } catch { return Symbol("error"); } });
        const right = starterGot.filter((g, i) => same(g, d.key.expected[i])).length;
        if (p.id === "plc-debug-estop-latch") {
          expect(right, "broken starter").toBeGreaterThan(0);
          expect(right, "broken starter").toBeLessThan(starterGot.length);
        } else {
          expect(right, "empty starter").toBe(0);
        }
      }
    });
  }

  it("scripted sequences exercise the interesting transitions across seeds", () => {
    const outputsSeen = (id: string, pick: (o: Record<string, unknown>) => unknown) => {
      const p = PLC_CODE_PROBLEMS.find((x) => x.id === id)!;
      return new Set(SEEDS.flatMap((s) => (p.build(makeRng(s)).key.expected as { outputs: Record<string, unknown> }[]).map((e) => pick(e.outputs))));
    };
    expect(outputsSeen("plc-on-delay-timer", (o) => o.done)).toEqual(new Set([true, false]));
    expect(outputsSeen("plc-ctu-box-counter", (o) => o.done)).toEqual(new Set([true, false]));
    expect(outputsSeen("plc-tank-fill-pump", (o) => o.pump)).toEqual(new Set([true, false]));
    expect(outputsSeen("plc-debounce-fault", (o) => o.fault)).toEqual(new Set([true, false]));
    expect(outputsSeen("plc-conveyor-stop-and-clamp", (o) => o.clamp)).toEqual(new Set([true, false]));
    expect(outputsSeen("plc-traffic-light-phases", (o) => o.red)).toEqual(new Set([true, false]));
  });
});

describe("PLC electrical calculation tickets", () => {
  for (const t of PLC_CALC_TEMPLATES) {
    it(`${t.id}: the answer key passes, blank/zero/wrong fails, and the key is not in the content`, () => {
      for (const seed of SEEDS) {
        const g = buildCalcChallenge(ctx(t.areas[0], seed), [t]);
        const { content, key } = asCalc(g);
        const solution = Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));
        expect(gradeCalc(content, key, solution).passed).toBe(true);
        expect(gradeCalc(content, key, {}).passed).toBe(false);
        expect(gradeCalc(content, key, Object.fromEntries(Object.keys(key.expected).map((k) => [k, "0"]))).passed).toBe(false);
        const first = Object.keys(key.expected)[0];
        expect(gradeCalc(content, key, { ...solution, [first]: String(key.expected[first] * 1.5) }).passed).toBe(false);
        const text = JSON.stringify(content);
        expect(text).not.toContain("tolerance");
        // whole-number answers such as a cable size can appear in a reference table by coincidence; the computed decimals must not
        for (const v of Object.values(key.expected).filter((n) => !Number.isInteger(n))) expect(text).not.toContain(String(v));
        expect(content.reference.length).toBeGreaterThan(0);
      }
    });
  }

  it("picks a table cable size that carries the derated load", () => {
    const t = PLC_CALC_TEMPLATES.find((x) => x.id === "plc-calc-cable-derating")!;
    for (const seed of SEEDS) {
      const d = t.build(makeRng(seed));
      expect(d.key.expected.size).toBeGreaterThan(0);
      expect(d.key.expected.required_rating).toBeGreaterThanOrEqual(Number(d.params[0].value));
    }
  });
});
