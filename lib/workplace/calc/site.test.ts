import { describe, expect, it } from "vitest";
import { buildCalcChallenge, gradeCalc } from "@/lib/arena-workstations/tools/calc";
import { GenerationRejected, type GenerationContext } from "@/lib/arena-workstations/types";
import { makeRng } from "@/lib/workplace/rng";
import type { CalcContent, CalcDraft, CalcKey, CalcTemplate } from "./types";
import { SITE_AREAS, SITE_CALC_TEMPLATES, clearOf } from "./site";

type Vals = Record<string, number>;
/** Param values by label; "1 in 400" and "1 : 1.5 : 3" are returned as their numbers in order. */
const read = (d: CalcDraft) => {
  const byLabel = (re: RegExp) => d.params.find((q) => re.test(q.label))!;
  const num = (re: RegExp) => Number(byLabel(re).value);
  const nums = (re: RegExp) => byLabel(re).value.match(/[\d.]+/g)!.map(Number);
  const all = (re: RegExp) => d.params.filter((q) => re.test(q.label)).map((q) => Number(q.value));
  return { num, nums, all, byLabel };
};

/** Independent reference computations: written from the reference sheet, not from the template code. */
const REFERENCE: Record<string, (d: CalcDraft) => Vals> = {
  "site-footing-concrete": (d) => {
    const { num } = read(d);
    const one = num(/side/) ** 2 * num(/depth/);
    return { one_footing: one, total_volume: one * num(/Number/) };
  },
  "site-plaster-area": (d) => {
    const { num } = read(d);
    const walls = 2 * (num(/length/) + num(/breadth/)) * num(/height/) - num(/Doors/) * 2.1 - num(/Windows/) * 1.44;
    return { wall_area: walls, total_area: walls + num(/length/) * num(/breadth/) };
  },
  "site-brick-wall": (d) => {
    const { num } = read(d);
    const area = num(/length/) * num(/height/) - num(/Doors/) * 2.1 - num(/Windows/) * 1.44;
    return { net_area: area, net_volume: area * num(/thickness/), bricks: area * num(/thickness/) * 500 };
  },
  "site-bar-steel": (d) => {
    const { num } = read(d);
    const dia = num(/diameter/);
    const cut = num(/Straight/) + (18 * dia) / 1000;
    return { cut_length: cut, total_weight: (cut * num(/Number/) * dia * dia) / 162 };
  },
  "site-nominal-mix": (d) => {
    const { num, nums } = read(d);
    const [c, s, a] = nums(/Nominal/);
    const unit = (1.54 * num(/required/)) / (c + s + a);
    return { cement_bags: (unit * c) / 0.0347, sand_m3: unit * s, aggregate_m3: unit * a };
  },
  "site-batch-wastage": (d) => {
    const { num } = read(d);
    const wet = num(/length/) * num(/breadth/) * num(/thickness/) * (1 + num(/Wastage/) / 100);
    const cementM3 = (wet * 1.54) / (1 + 1.5 + 3);
    const bags = cementM3 / 0.0347;
    return { cement_bags: bags, water_litres: bags * 50 * num(/Water-cement/) };
  },
  "site-cube-acceptance": (d) => {
    const { num, all } = read(d);
    const s = all(/Cube \d/).map((kn) => kn / 22.5);
    const avg = (s[0] + s[1] + s[2]) / 3;
    const fck = num(/Specified/);
    return { avg_strength: avg, min_strength: Math.min(...s), accept: avg >= fck + 3 && Math.min(...s) >= fck - 3 ? 1 : 0 };
  },
  "site-reduced-levels-hi": (d) => {
    const { num } = read(d);
    const hi = num(/RL of benchmark/) + num(/Backsight/);
    return { hi, rl_is: hi - num(/Intermediate/), rl_fs: hi - num(/Foresight/) };
  },
  // via the height-of-collimation check, a different route to the same RL
  "site-rise-fall": (d) => {
    const { num, all } = read(d);
    const r = all(/Staff reading/);
    let rise = 0;
    let fall = 0;
    for (let i = 1; i < r.length; i++) (r[i] < r[i - 1] ? (rise += r[i - 1] - r[i]) : (fall += r[i] - r[i - 1]));
    return { total_rise: rise, total_fall: fall, rl_last: num(/RL of benchmark/) + r[0] - r[r.length - 1] };
  },
  "site-cut-fill": (d) => {
    const { num, nums } = read(d);
    const n = nums(/Gradient/)[1];
    const bed = num(/bed RL at A/) - num(/Distance/) / n;
    return { gradient_percent: 100 / n, bed_b: bed, cut_b: num(/ground RL/) - bed };
  },
  "site-boq-line-totals": (d) => {
    const rates = read(d).all(/rate/);
    const qty = read(d).all(/quantity/);
    const lines = rates.map((r, i) => r * qty[i]);
    return { line1: lines[0], line2: lines[1], line3: lines[2], subtotal: lines.reduce((a, c) => a + c, 0) };
  },
  "site-gst-overhead": (d) => {
    const { num } = read(d);
    const a = num(/Direct/) * (100 + num(/Overhead/)) / 100;
    const b = (a * (100 + num(/Profit/))) / 100;
    return { after_overhead: a, after_profit: b, gst_amount: (b * num(/GST/)) / 100, grand_total: (b * (100 + num(/GST/))) / 100 };
  },
  "site-material-reconciliation": (d) => {
    const { num } = read(d);
    const book = num(/Opening/) + num(/Received/) - num(/Issued/);
    return { book_balance: book, shortfall: book - num(/Physical/), wastage_pct: ((book - num(/Physical/)) * 100) / num(/Issued/) };
  },
  "site-productivity-crew-days": (d) => {
    const { num } = read(d);
    const effort = num(/Quantity/) / num(/Output/);
    return { crew_days: effort, duration_days: effort / num(/Masons/) };
  },
  "site-percent-complete": (d) => {
    const { all } = read(d);
    const b = all(/budget/);
    const t = all(/total quantity/);
    const q = all(/quantity done/);
    const earned = b.reduce((s, x, i) => s + x * (q[i] / t[i]), 0);
    return { earned_value: earned, overall_pct: (earned * 100) / b.reduce((s, x) => s + x, 0) };
  },
  "site-schedule-delay": (d) => {
    const { num } = read(d);
    const forecast = num(/Days elapsed/) / (num(/completed/) / 100);
    return { forecast_days: forecast, delay_days: forecast - num(/Planned/) };
  },
  "site-scaffold-capacity": (d) => {
    const { num } = read(d);
    const cap = num(/limit/) * num(/length/) * num(/width/);
    const load = num(/Workers/) * num(/per worker/) + num(/Stacked/);
    return { capacity_kn: cap, applied_kn: load, utilisation_pct: (load / cap) * 100, within_limit: load <= cap ? 1 : 0 };
  },
  "site-ppe-counts": (d) => {
    const { num } = read(d);
    return { helmets: Math.ceil((num(/Workers on/) * 110) / 100), harnesses: Math.ceil((num(/at height/) * 110) / 100) };
  },
  "site-hoist-limit": (d) => {
    const { num } = read(d);
    const left = num(/rated/) - num(/pallet/) - num(/bags on/) * num(/one bag/);
    return { remaining_kg: left, max_bricks: Math.floor(left / num(/one brick/)) };
  },
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const ctxFor = (t: CalcTemplate, seed: number): GenerationContext => ({ roleName: "Site Engineer", parentSkill: "Site Engineering", areaName: "Area", difficulty: t.difficulty, avoidTitles: [], areaKey: t.areas[0], ticketSeed: seed, level: "fresher" });
const solution = (k: CalcKey) => Object.fromEntries(Object.entries(k.expected).map(([key, v]) => [key, String(v)]));

describe("site engineer calc templates", () => {
  it("covers six site- areas, >= 12 templates, easy and medium, every area has an easy fresher ticket", () => {
    expect(SITE_CALC_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    const areas = new Set(SITE_CALC_TEMPLATES.flatMap((t) => t.areas));
    expect([...areas].sort()).toEqual(Object.values(SITE_AREAS).sort());
    for (const a of areas) expect(SITE_CALC_TEMPLATES.some((t) => t.areas.includes(a) && t.difficulty === "easy" && t.minLevel === "fresher"), a).toBe(true);
    expect(new Set(SITE_CALC_TEMPLATES.map((t) => t.difficulty))).toEqual(new Set(["easy", "medium"]));
    expect(new Set(SITE_CALC_TEMPLATES.map((t) => t.id)).size).toBe(SITE_CALC_TEMPLATES.length);
    expect(Object.keys(REFERENCE).sort()).toEqual(SITE_CALC_TEMPLATES.map((t) => t.id).sort());
  });

  for (const t of SITE_CALC_TEMPLATES) {
    describe(t.id, () => {
      it("matches an independent reference computation and the solution passes", () => {
        for (const seed of SEEDS) {
          const g = buildCalcChallenge(ctxFor(t, seed), [t]);
          const content = g.content as unknown as CalcContent;
          const key = g.answer_key as unknown as CalcKey;
          const draft: CalcDraft = { title: g.title, requester: { name: "", title: "" }, scenario: g.scenario, params: content.params, fields: content.fields, key, reference: content.reference };
          const ref = REFERENCE[t.id](draft);
          expect(Object.keys(key.expected).sort()).toEqual(content.fields.map((x) => x.key).sort());
          for (const [k, v] of Object.entries(ref)) expect(key.expected[k], `${k} seed ${seed}`).toBeCloseTo(v, 6);
          expect(gradeCalc(content, key, solution(key)).passed).toBe(true);
          expect(gradeCalc(content, key, Object.fromEntries(Object.entries(ref).map(([k, v]) => [k, v.toFixed(3)]))).passed, `reference to 3dp, seed ${seed}`).toBe(true);
        }
      });

      it("fails blank, text and zero submissions and never leaks the key", () => {
        const g = buildCalcChallenge(ctxFor(t, 5), [t]);
        const content = g.content as unknown as CalcContent;
        const key = g.answer_key as unknown as CalcKey;
        const fields = content.fields.map((x) => x.key);
        expect(gradeCalc(content, key, {}).passed).toBe(false);
        expect(gradeCalc(content, key, Object.fromEntries(fields.map((k) => [k, "abc"]))).passed).toBe(false);
        expect(gradeCalc(content, key, Object.fromEntries(fields.map((k) => [k, "0"]))).passed).toBe(false);
        const bumped = { ...solution(key), [fields[0]]: String(key.expected[fields[0]] * 1.5 + 5) };
        expect(gradeCalc(content, key, bumped).checks[0].passed).toBe(false);
        const text = JSON.stringify(content);
        expect(text).not.toContain("tolerance");
        expect(JSON.stringify(g.scenario)).not.toContain("expected");
        expect(content.reference.length).toBeGreaterThan(0);
      });
    });
  }

  it("keeps clear of rounding and pass/fail boundaries", () => {
    const byId = (id: string) => SITE_CALC_TEMPLATES.find((t) => t.id === id)!;
    for (const seed of SEEDS) {
      const draft = (id: string) => byId(id).build(makeRng(seed));
      const scaf = draft("site-scaffold-capacity").key.expected;
      expect(Math.abs(scaf.utilisation_pct - 100)).toBeGreaterThanOrEqual(5);
      expect(Math.abs(draft("site-schedule-delay").key.expected.delay_days)).toBeGreaterThanOrEqual(5);
      expect(Math.abs(draft("site-cut-fill").key.expected.cut_b)).toBeGreaterThanOrEqual(0.08);
      const ppe = draft("site-ppe-counts");
      const crew = Number(ppe.params[0].value);
      expect(Math.abs(crew * 1.1 - Math.round(crew * 1.1))).toBeGreaterThanOrEqual(0.05);
      const cube = draft("site-cube-acceptance");
      const fck = Number(cube.params[0].value);
      const loads = [1, 2, 3].map((i) => Number(cube.params[i].value) / 22.5);
      expect(Math.abs(loads.reduce((a, c) => a + c, 0) / 3 - (fck + 3))).toBeGreaterThanOrEqual(0.5);
      expect(Math.abs(Math.min(...loads) - (fck - 3))).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("rejects the ticket when every candidate is ambiguous", () => {
    expect(() => clearOf(() => null)).toThrow(GenerationRejected);
    expect(clearOf(() => 7)).toBe(7);
  });

  it("is deterministic per seed and varies across seeds", () => {
    const t = SITE_CALC_TEMPLATES[0];
    expect(buildCalcChallenge(ctxFor(t, 9), [t])).toEqual(buildCalcChallenge(ctxFor(t, 9), [t]));
    expect(new Set(SEEDS.map((s) => JSON.stringify(buildCalcChallenge(ctxFor(t, s), [t]).answer_key))).size).toBeGreaterThan(5);
  });
});
