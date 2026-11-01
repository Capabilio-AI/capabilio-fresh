import { describe, expect, it } from "vitest";
import { generateBrightCart } from "../worlds/brightcart";
import { hashSeed, makeRng } from "../rng";
import { evaluateSpec, gradeDashboard, type BiSpec } from "@/lib/arena-workstations/engines/bi";
import { DASHBOARD_TEMPLATES } from "./dashboard-templates";
import { checkDashboard } from "./pick";

const IDS = ["dash-dax-return-rate", "dash-dax-city-share", "dash-dax-delivered-price", "dash-dax-return-loss"];
const draft = (id: string, i: number) => DASHBOARD_TEMPLATES.find((t) => t.id === id)!.build(makeRng(hashSeed("dax-t", id, i)), generateBrightCart(hashSeed("w", i)))!;

describe("DAX dashboard tickets", () => {
  it("are for graduates and above, never for a first-year fresher", () => {
    for (const id of IDS) expect(DASHBOARD_TEMPLATES.find((t) => t.id === id)!.minLevel).not.toBe("fresher");
  });

  for (const id of IDS) {
    it(`${id}: buildable on most data, requires a DAX measure, and its own key passes`, () => {
      let ok = 0;
      for (let i = 0; i < 8; i++) {
        const d = draft(id, i);
        if (!d || !checkDashboard(d).ok) continue;
        ok++;
        expect(d.spec.dax).not.toBeNull();
        expect(gradeDashboard(d.dataset, d.spec, d.spec).passed).toBe(true);
        const noDax = { ...d.spec, dax: null, aggregation: "sum" as const, measure: "revenue" };
        const wrong = gradeDashboard(d.dataset, d.spec, noDax);
        expect(wrong.passed).toBe(false);
        expect(wrong.checks[0].label).toMatch(/DAX/);
        expect(wrong.checks[0].passed).toBe(false);
      }
      expect(ok).toBeGreaterThanOrEqual(6);
    });
  }

  it("city shares add up to about 100, and every return rate is a percent", () => {
    for (let i = 0; i < 6; i++) {
      const share = draft("dash-dax-city-share", i);
      const total = evaluateSpec(share.dataset, share.spec).reduce((s, p) => s + p.value, 0);
      expect(Math.abs(total - 100)).toBeLessThan(0.1);
      for (const p of evaluateSpec(draft("dash-dax-return-rate", i).dataset, draft("dash-dax-return-rate", i).spec)) expect(p.value >= 0 && p.value <= 100).toBe(true);
    }
  });

  it("accepts a different but equivalent formula, because the value is what is graded", () => {
    const d = draft("dash-dax-delivered-price", 1);
    const alt: BiSpec = { ...d.spec, dax: 'CALCULATE(SUM([revenue]), [status] = "delivered") / CALCULATE(SUM([quantity]), [status] = "delivered")' };
    expect(gradeDashboard(d.dataset, d.spec, alt).passed).toBe(true);
  });

  it("reports a formula that cannot be built instead of crashing the grader", () => {
    const d = draft("dash-dax-city-share", 0);
    const bad = gradeDashboard(d.dataset, d.spec, { ...d.spec, dax: "SUM([nope]" });
    expect(bad.passed).toBe(false);
    expect(bad.message).toMatch(/can't be built/);
  });
});
