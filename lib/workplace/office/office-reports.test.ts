import { describe, expect, it } from "vitest";
import { gradeDashboard } from "@/lib/arena-workstations/engines/bi";
import { gradeAnswers } from "@/lib/arena-workstations/engines/stats";
import { generateBrightCart } from "../worlds/brightcart";
import { hashSeed, makeRng } from "../rng";
import { DASHBOARD_TEMPLATES } from "./dashboard-templates";
import { STATS_TEMPLATES } from "./stats-templates";
import { checkDashboard, checkStats } from "./pick";

const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("reports-test", i));

describe("dashboard tickets on the company data", () => {
  for (const template of DASHBOARD_TEMPLATES) {
    it(`${template.id}: valid for most users, the right chart passes and a wrong one fails`, () => {
      let ok = 0;
      const reasons: string[] = [];
      for (const seed of SEEDS) {
        const draft = template.build(makeRng(seed), generateBrightCart(seed));
        expect(draft.scenario.length).toBeGreaterThan(40);
        const verdict = checkDashboard(draft);
        if (!verdict.ok) { reasons.push(verdict.reason); continue; }
        ok++;
        expect(gradeDashboard(draft.dataset, draft.spec, draft.spec).passed).toBe(true);
        // the same chart over a different slice of the data must not pass
        const other = draft.spec.dimension === "city" ? "category" : "city";
        expect(gradeDashboard(draft.dataset, draft.spec, { ...draft.spec, dimension: other }).passed).toBe(false);
        expect(gradeDashboard(draft.dataset, draft.spec, { ...draft.spec, filters: [] }).passed).toBe(false);
      }
      expect(ok, `rejections: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.9));
    });
  }
});

describe("statistics tickets on the company data", () => {
  for (const template of STATS_TEMPLATES) {
    it(`${template.id}: valid for most users, correct answers pass and wrong ones fail`, () => {
      let ok = 0;
      const reasons: string[] = [];
      for (const seed of SEEDS) {
        const draft = template.build(makeRng(seed), generateBrightCart(seed));
        expect(draft.scenario.length).toBeGreaterThan(40);
        const verdict = checkStats(draft);
        if (!verdict.ok) { reasons.push(verdict.reason); continue; }
        ok++;
        const { expected } = verdict.value;
        const right = Object.fromEntries(expected.map((e) => [e.key, String(e.value)]));
        expect(gradeAnswers(expected, right).every((r) => r.passed)).toBe(true);
        const wrong = Object.fromEntries(expected.map((e) => [e.key, typeof e.value === "number" ? String(e.value + 5) : e.value === "Yes" ? "No" : "Yes"]));
        expect(gradeAnswers(expected, wrong).some((r) => r.passed)).toBe(false);
      }
      expect(ok, `rejections: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.9));
    });
  }

  it("uses the statistics each difficulty allows", () => {
    const allowed = { easy: ["mean", "median", "sample_std"], medium: ["mean", "median", "sample_std", "pearson_r", "ci95_mean"], hard: ["sample_std", "pearson_r", "ci95_mean", "regression", "two_proportion_test"] };
    for (const t of STATS_TEMPLATES) {
      const draft = t.build(makeRng(1), generateBrightCart(1));
      for (const q of draft.questions) expect(allowed[t.difficulty], `${t.id} uses ${q.statistic}`).toContain(q.statistic);
    }
  });
});
