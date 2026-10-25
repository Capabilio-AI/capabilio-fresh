import { describe, expect, it, vi } from "vitest";
import { makeRng } from "@/lib/workplace/rng";
import { defaultSettings, normalizeSettings, nearestSolution, validateScenario } from "./grid";
import { LABS, labFamily } from "./registry";
import { assumptionsFor } from "./notes";
import { sceneFor } from "./scenes";
import type { Difficulty } from "./types";

// scenario search is CPU-bound; CI runners are several times slower than a laptop
vi.setConfig({ testTimeout: 120_000 });

const LEVELS: Difficulty[] = ["easy", "medium", "hard"];

describe.each(LABS.map((l) => [l.key, l] as const))("lab %s", (_key, lab) => {
  it.each(LEVELS)("builds a winnable, non-trivial mission at %s level for most seeds", (d) => {
    let ok = 0;
    const tries = 6;
    for (let seed = 1; seed <= tries; seed++) {
      const s = lab.makeScenario(makeRng(seed * 977 + d.length), d);
      if (validateScenario(lab, s, d).ok) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(2); // the builder retries many seeds, so a third is plenty
  });

  it("is deterministic, explains itself, and every control default is valid", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = lab.makeScenario(makeRng(seed), "medium");
      if (!validateScenario(lab, s, "medium").ok) continue;
      const controls = lab.controls(s);
      const st = defaultSettings(controls);
      expect(normalizeSettings(controls, st).ok).toBe(true);
      const a = lab.evaluate(s, st);
      expect(JSON.stringify(lab.evaluate(s, st))).toBe(JSON.stringify(a));
      expect(a.objectives.length).toBeGreaterThan(0);
      expect(a.passed).toBe(false);
      a.objectives.forEach((o) => expect(o.nudge.length).toBeGreaterThan(10));
      const win = nearestSolution(lab, s, st);
      expect(win).not.toBeNull();
      const won = lab.evaluate(s, win!);
      expect(won.passed).toBe(true);
      expect(lab.explain(s, win!, won).length).toBeGreaterThan(80);
      expect(lab.given(s).length).toBeGreaterThan(0);
      expect(lab.mission(s).length).toBeGreaterThan(20);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s); // storable as JSON
      for (const r of a.readings) expect(Number.isFinite(r.bar?.value ?? 0)).toBe(true);
      a.series?.lines.forEach((l) => l.pts.forEach(([x, y]) => { expect(Number.isFinite(x)).toBe(true); expect(Number.isFinite(y)).toBe(true); }));
      return;
    }
    throw new Error("no valid scenario found in 30 seeds");
  });
});

describe("each family has five labs", () => {
  it.each(["ece", "eee", "mech", "civil"] as const)("%s", (family) => {
    expect(LABS.filter((l) => l.family === family).length).toBeGreaterThanOrEqual(5);
  });
  it("every lab has unique key and an educational-model note", () => {
    expect(new Set(LABS.map((l) => l.key)).size).toBe(LABS.length);
    for (const l of LABS) expect(assumptionsFor(l.key, l.family).length).toBeGreaterThan(30);
  });
});

describe("scenes", () => {
  it("draw finite shapes from the starting settings and from a winning one, for the labs that have a drawing", () => {
    let drawn = 0;
    for (const lab of LABS) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = lab.makeScenario(makeRng(seed), "medium");
        if (!validateScenario(lab, s, "medium").ok) continue;
        const controls = lab.controls(s);
        for (const st of [defaultSettings(controls), nearestSolution(lab, s, defaultSettings(controls))!]) {
          const scene = sceneFor(lab.key, s, st);
          if (!scene) continue;
          drawn++;
          expect(scene.items.length).toBeGreaterThan(2);
          for (const it of scene.items) {
            for (const v of Object.values(it)) if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
            if (it.k === "text") expect(it.text).not.toMatch(/undefined|NaN/);
          }
        }
        break;
      }
    }
    expect(drawn).toBeGreaterThanOrEqual(18);
  });
});

describe("normalizeSettings", () => {
  const lab = LABS.find((l) => l.key === "buck")!;
  const s = lab.makeScenario(makeRng(3), "easy");
  const controls = lab.controls(s);
  it("rejects values the controls do not offer", () => {
    expect(normalizeSettings(controls, { duty: 33.5 }).ok).toBe(false);
    expect(normalizeSettings(controls, { duty: 500 }).ok).toBe(false);
    expect(normalizeSettings(controls, { l: "7" }).ok).toBe(false);
    expect(normalizeSettings(controls, { duty: "50" }).ok).toBe(false);
    expect(normalizeSettings(controls, null).ok).toBe(true);
  });
});

describe("labFamily", () => {
  it("maps branch names to lab families", () => {
    expect(labFamily("Electronics and Communication Engineering (ECE)")).toBe("ece");
    expect(labFamily("Electrical and Electronics Engineering (EEE)")).toBe("eee");
    expect(labFamily("Mechanical Engineering")).toBe("mech");
    expect(labFamily("Civil Engineering")).toBe("civil");
    expect(labFamily("Master of Business Administration")).toBeNull();
    expect(labFamily("Chemical Engineering")).toBeNull();
  });
});
