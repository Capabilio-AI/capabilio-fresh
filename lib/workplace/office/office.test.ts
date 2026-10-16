import { describe, expect, it } from "vitest";
import { applySteps, compareCleanTables } from "@/lib/arena-workstations/engines/cleaning";
import { gradeSpreadsheet } from "@/lib/arena-workstations/engines/spreadsheet";
import { generateBrightCart } from "../worlds/brightcart";
import { hashSeed, makeRng } from "../rng";
import { CLEAN_TEMPLATES } from "./clean-templates";
import { SHEET_TEMPLATES } from "./sheet-templates";
import { checkClean, checkSheet } from "./pick";
import { solveSheet } from "./solver";

const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("office-test", i));

describe("spreadsheet tickets on the company data", () => {
  for (const template of SHEET_TEMPLATES) {
    it(`${template.id}: valid for most users, solved by the right formulas, failed by wrong ones`, () => {
      let ok = 0;
      const reasons: string[] = [];
      for (const seed of SEEDS) {
        const draft = template.build(makeRng(seed), generateBrightCart(seed));
        expect(draft.scenario.length).toBeGreaterThan(40);
        const verdict = checkSheet(draft);
        if (!verdict.ok) { reasons.push(verdict.reason); continue; }
        ok++;
        const { layout, expected } = verdict.value;
        const cells = solveSheet(draft.content, layout);
        expect(gradeSpreadsheet(draft.content, expected, cells).passed).toBe(true);
        // typed-in numbers must not pass, even when right
        const first = layout.targets[0].cells[0];
        expect(gradeSpreadsheet(draft.content, expected, { ...cells, [first]: String(expected[first]) }).passed).toBe(false);
        // doing nothing must not pass
        expect(gradeSpreadsheet(draft.content, expected, {}).passed).toBe(false);
      }
      expect(ok, `rejections: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.9));
    });
  }

  it("uses the user's own warehouse: two users get different sheets", () => {
    const t = SHEET_TEMPLATES[0];
    const a = t.build(makeRng(1), generateBrightCart(1));
    const b = t.build(makeRng(2), generateBrightCart(2));
    expect(JSON.stringify(a.content.data.rows)).not.toBe(JSON.stringify(b.content.data.rows));
  });
});

describe("data cleaning tickets on a large messy export", () => {
  for (const template of CLEAN_TEMPLATES) {
    it(`${template.id}: valid for most users, and every step is needed`, () => {
      let ok = 0;
      const reasons: string[] = [];
      for (const seed of SEEDS) {
        const draft = template.build(makeRng(seed), generateBrightCart(seed));
        expect(draft.scenario.length).toBeGreaterThan(40);
        const verdict = checkClean(draft);
        if (!verdict.ok) { reasons.push(verdict.reason); continue; }
        ok++;
        const expected = applySteps(draft.dataset, draft.steps);
        expect(draft.dataset.rows.length).toBeGreaterThanOrEqual(80);
        // the raw table itself must not already be the answer
        expect(compareCleanTables(expected, draft.dataset).passed).toBe(false);
        // leaving out any one step must give a different table
        draft.steps.forEach((_, skip) => {
          const partial = applySteps(draft.dataset, draft.steps.filter((__, i) => i !== skip));
          expect(compareCleanTables(expected, partial).passed, `step ${skip + 1} of ${template.id} is not needed`).toBe(false);
        });
      }
      expect(ok, `rejections: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.9));
    });
  }
});
