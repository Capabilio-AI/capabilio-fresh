import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/workplace/rng";
import { buildCalcChallenge, gradeCalc } from "@/lib/arena-workstations/tools/calc";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import type { CalcContent, CalcDraft, CalcKey } from "./types";
import { checked, MECH_CALC_TEMPLATES } from "./mech";

type Vals = Record<string, number>;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const area = (d: number) => (Math.PI / 4) * d ** 2;
const MAT = ["Mild steel", "Medium-carbon steel", "Aluminium alloy", "Titanium alloy"];
const mats = (p: Vals) => MAT.map((n) => ({ y: p[`${n} yield strength`], d: p[`${n} density`], c: p[`${n} cost`] }));
const feasible = (p: Vals) => {
  const req = (p["Required factor of safety"] * p["Rod force"] * 1000) / p["Rod cross-section area"];
  const m = (x: { d: number }) => x.d * (p["Rod cross-section area"] / 1e6) * p["Rod length"];
  return { req, ok: mats(p).filter((x) => x.y >= req), m };
};

/** Independent reference: each number is recomputed here from the parameters the student sees, written differently from the template code. */
const REF: Record<string, (p: Vals) => Vals> = {
  "mech-ss-point-load": (p) => ({ ra: p["Point load"] - (p["Point load"] * p["Load distance from A"]) / p.Span, rb: (p["Point load"] * p["Load distance from A"]) / p.Span }),
  "mech-cantilever-udl": (p) => ({ r: p["Uniform load"] * p.Length, m: 0.5 * p["Uniform load"] * p.Length ** 2 }),
  "mech-ss-udl-plus-point": (p) => ({ r: (p["Uniform load"] * p.Span) / 2 + p["Mid-span point load"] / 2, m: (p["Uniform load"] * p.Span ** 2) / 8 + (p["Mid-span point load"] * p.Span) / 4 }),
  "mech-rod-axial-stress": (p) => {
    const s = (p["Axial force"] * 1000) / area(p["Rod diameter"]);
    return { stress: s, fos: p["Yield strength"] / s, ok: p["Yield strength"] / s >= p["Required factor of safety"] ? 1 : 0 };
  },
  "mech-pin-double-shear": (p) => ({ tau: (p["Pin load"] * 1000) / 2 / area(p["Pin diameter"]), dmin: 2 * Math.sqrt((p["Pin load"] * 1000) / 2 / (Math.PI * p["Allowable shear stress"])) }),
  "mech-beam-bending-stress": (p) => {
    const m = (p["Mid-span load"] * p.Span) / 4;
    return { m, sigma: (m * 1e6) / ((p["Section width b"] * p["Section depth h"] ** 2) / 6) };
  },
  "mech-beam-deflection": (p) => {
    const i = (p["Section width b"] * p["Section depth h"] ** 3) / 12;
    return { i, delta: (p["Mid-span load"] * 1000 * p.Span ** 3) / (48 * p["Elastic modulus E"] * i) };
  },
  "mech-tolerance-stack": (p) => {
    const t = [p["Housing tolerance"], p["Part 1 tolerance"], p["Part 2 tolerance"], p["Part 3 tolerance"]];
    return { gap: p["Housing inner length"] - sum([p["Part 1 length"], p["Part 2 length"], p["Part 3 length"]]), wc: sum(t), rss: Math.hypot(...t) };
  },
  "mech-hole-shaft-fit": (p) => {
    const D = p["Nominal size"];
    const hole = [D, D + p["Hole upper deviation"]], shaft = [D + p["Shaft upper deviation"] - p["Shaft tolerance band"], D + p["Shaft upper deviation"]];
    const maxc = hole[1] - shaft[0], minc = hole[0] - shaft[1];
    return { maxc, minc, kind: minc > 0 ? 1 : maxc <= 0 ? 3 : 2 };
  },
  "mech-gear-train": (p) => ({ ratio: p["Gear teeth"] / p["Pinion teeth"], n: p["Motor speed"] / (p["Gear teeth"] / p["Pinion teeth"]), t: p["Motor torque"] * (p["Gear teeth"] / p["Pinion teeth"]) * p["Mesh efficiency"] }),
  "mech-belt-speed": (p) => ({ v: (2 * Math.PI * (p["Driver pulley diameter"] / 2000) * p["Driver speed"]) / 60, n2: (p["Driver speed"] * p["Driver pulley diameter"]) / p["Driven pulley diameter"] }),
  "mech-shaft-torque-stress": (p) => {
    const t = (p.Power * 1000) / ((2 * Math.PI * p["Shaft speed"]) / 60);
    return { t, tau: (t * 1000) / ((Math.PI / 16) * p["Shaft diameter"] ** 3) };
  },
  "mech-bearing-l10": (p) => {
    const l10 = Math.pow(p["Basic dynamic load rating C"] / p["Equivalent load P"], 3);
    return { l10, hours: (l10 * 1e6) / (60 * p.Speed) };
  },
  "mech-material-cheapest": (p) => {
    const { req, ok, m } = feasible(p);
    return { req, count: ok.length, cost: Math.min(...ok.map((x) => m(x) * x.c)) };
  },
  "mech-material-lightest": (p) => {
    const { ok, m } = feasible(p);
    return { count: ok.length, mass: Math.min(...ok.map(m)) };
  },
  "mech-bolt-preload": (p) => ({ fi: (0.75 * p["Proof strength"] * p["Tensile stress area"]) / 1000, t: (p["Torque coefficient K"] * ((0.75 * p["Proof strength"] * p["Tensile stress area"]) / 1000) * p["Bolt nominal diameter"]) }),
  "mech-bolt-shear-count": (p) => {
    const cap = (p["Allowable shear stress"] * area(p["Bolt diameter"])) / 1000;
    return { cap, total: p["Bolts fitted"] * cap, need: Math.ceil(p["Shear load on the joint"] / cap) };
  },
};

const AREAS = ["mech-statics-and-loads", "mech-stress-and-strength", "mech-fits-and-tolerances", "mech-power-transmission", "mech-materials-and-selection", "mech-fasteners"];
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const draftOf = (t: (typeof MECH_CALC_TEMPLATES)[number], seed: number): CalcDraft => t.build(makeRng(seed));
const vals = (d: CalcDraft): Vals => Object.fromEntries(d.params.map((x) => [x.label, Number(x.value)]));
const answers = (key: CalcKey) => Object.fromEntries(Object.entries(key.expected).map(([k, v]) => [k, String(v)]));
const ctx = (areaKey: string, seed: number): GenerationContext => ({ roleName: "r", parentSkill: "p", areaName: "A", difficulty: "easy", avoidTitles: [], areaKey, ticketSeed: seed, level: "fresher" });

describe("mech calc templates", () => {
  it("covers every area, with an easy fresher ticket in each, easy and medium only", () => {
    expect(MECH_CALC_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(MECH_CALC_TEMPLATES.map((t) => t.id)).size).toBe(MECH_CALC_TEMPLATES.length);
    for (const a of AREAS) expect(MECH_CALC_TEMPLATES.some((t) => t.areas.includes(a) && t.difficulty === "easy" && t.minLevel === "fresher")).toBe(true);
    for (const t of MECH_CALC_TEMPLATES) {
      expect(["easy", "medium"]).toContain(t.difficulty);
      expect(t.minLevel).toBe("fresher");
      expect(AREAS).toContain(t.areas[0]);
      expect(REF[t.id]).toBeDefined();
    }
    expect(new Set(MECH_CALC_TEMPLATES.map((t) => t.difficulty))).toEqual(new Set(["easy", "medium"]));
  });

  for (const t of MECH_CALC_TEMPLATES) {
    describe(t.id, () => {
      it("matches an independent reference computation on every seed", () => {
        for (const seed of SEEDS) {
          const d = draftOf(t, seed);
          const ref = REF[t.id](vals(d));
          expect(Object.keys(ref).sort()).toEqual(d.fields.map((f) => f.key).sort());
          for (const f of d.fields) {
            const tolerance = d.key.tolerance[f.key];
            expect(Math.abs(ref[f.key] - d.key.expected[f.key]), `${f.key} seed ${seed}`).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(ref[f.key])));
            expect(tolerance).toBeGreaterThan(0);
          }
        }
      });

      it("accepts the solution, and rejects a blank, a zero and an off-by-half submission", () => {
        for (const seed of SEEDS) {
          const g = buildCalcChallenge(ctx(t.areas[0], seed), [t]);
          const c = g.content as unknown as CalcContent;
          const key = g.answer_key as unknown as CalcKey;
          expect(gradeCalc(c, key, answers(key)).passed).toBe(true);
          expect(gradeCalc(c, key, {}).passed).toBe(false);
          expect(gradeCalc(c, key, Object.fromEntries(c.fields.map((f) => [f.key, "0"]))).passed).toBe(false);
          for (const f of c.fields) {
            const wrong = { ...answers(key), [f.key]: String(key.expected[f.key] * 1.5 + 1) };
            expect(gradeCalc(c, key, wrong).passed, `${f.key} seed ${seed}`).toBe(false);
          }
        }
      });

      it("is deterministic and varies with the seed", () => {
        expect(draftOf(t, 9)).toEqual(draftOf(t, 9));
        expect(new Set(SEEDS.map((s) => JSON.stringify(draftOf(t, s).key))).size).toBeGreaterThan(1);
      });

      it("never leaks the key into the student's content", () => {
        const g = buildCalcChallenge(ctx(t.areas[0], 3), [t]);
        const text = JSON.stringify(g.content);
        expect(text).not.toContain('"tolerance"');
        expect(text).not.toContain('"expected"');
      });
    });
  }
});

describe("checked()", () => {
  const base = { title: "t", requester: { name: "n", title: "r" }, scenario: "s", params: [], fields: [{ key: "a", label: "A", unit: "" }], reference: [] };
  const rng = makeRng(1);

  it("rejects non-finite answers", () => {
    expect(() => checked(rng, () => ({ ...base, expected: { a: NaN } }))).toThrow();
    expect(() => checked(rng, () => ({ ...base, expected: {} }))).toThrow();
  });

  it("rejects a draw whose wrong-method answer is within tolerance, and keeps a clear one", () => {
    expect(() => checked(rng, () => ({ ...base, expected: { a: 100 }, traps: { a: [101] } }))).toThrow();
    expect(checked(rng, () => ({ ...base, expected: { a: 100 }, traps: { a: [150] } })).key.expected.a).toBe(100);
  });

  it("redraws when the generator reports a boundary case", () => {
    let calls = 0;
    const d = checked(rng, () => (++calls < 3 ? null : { ...base, expected: { a: 1 } }));
    expect(calls).toBe(3);
    expect(d.key.expected.a).toBe(1);
  });
});

describe("mech role descriptors", () => {
  it("validate and list exactly the template areas", async () => {
    const { validateBlueprint } = await import("@/lib/arena-roles/blueprint");
    const { validateToolkit } = await import("@/lib/arena-roles/toolkit/types");
    const { MECHANICAL_DESIGN_ENGINEER } = await import("@/lib/arena-roles/blueprints/mechanical-design-engineer");
    const { TOOLKIT } = await import("@/lib/arena-roles/toolkit/mechanical-design-engineer");
    expect(validateBlueprint(MECHANICAL_DESIGN_ENGINEER)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    expect(MECHANICAL_DESIGN_ENGINEER.areas.map((a) => a.areaKey).sort()).toEqual([...AREAS].sort());
  });
});
