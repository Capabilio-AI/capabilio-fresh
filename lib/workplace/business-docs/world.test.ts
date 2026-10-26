import { describe, expect, it } from "vitest";
import { sqlJsRunner } from "@/lib/arena-content/sqljs-runner";
import { gradeDashboard } from "@/lib/arena-workstations/engines/bi";
import { gradeSpreadsheet } from "@/lib/arena-workstations/engines/spreadsheet";
import { hashSeed, makeRng } from "../rng";
import { runSqlScript } from "../sql/local-runner";
import { checkDashboard, checkSheet } from "../office/pick";
import { solveSheet } from "../office/solver";
import { validateDraft, type Runners } from "../tickets/pick";
import { generateKaveri } from "./kaveri";
import { KAVERI_WORLD } from "./world";

const runners: Runners = { query: sqlJsRunner, script: (seed, script, probes) => runSqlScript(seed, script, probes) };
const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("kaveri-test", i));
const office = KAVERI_WORLD.office!;

describe("Kaveri world", () => {
  it("is deterministic per seed and different across users", () => {
    expect(JSON.stringify(generateKaveri(1))).toBe(JSON.stringify(generateKaveri(1)));
    expect(JSON.stringify(generateKaveri(1))).not.toBe(JSON.stringify(generateKaveri(2)));
  });

  it("serves only Business Analyst areas", () => {
    expect(new Set(KAVERI_WORLD.templates.flatMap((t) => t.areas ?? ["sql"]))).toEqual(new Set(["data-queries"]));
    expect(new Set(office.sheets.flatMap((t) => t.areas))).toEqual(new Set(["business-metrics"]));
    expect(new Set(office.dashboards.flatMap((t) => t.areas))).toEqual(new Set(["reporting"]));
  });

  for (const template of office.sheets) {
    it(`${template.id}: solved by the right formulas, failed by typed numbers and by nothing`, () => {
      let ok = 0;
      for (const seed of SEEDS) {
        const draft = template.build(makeRng(seed), generateKaveri(seed));
        const verdict = checkSheet(draft);
        if (!verdict.ok) continue;
        ok++;
        const { layout, expected } = verdict.value;
        const cells = solveSheet(draft.content, layout);
        expect(gradeSpreadsheet(draft.content, expected, cells).passed).toBe(true);
        const first = layout.targets[0].cells[0];
        expect(gradeSpreadsheet(draft.content, expected, { ...cells, [first]: String(expected[first]) }).passed).toBe(false);
        expect(gradeSpreadsheet(draft.content, expected, {}).passed).toBe(false);
      }
      expect(ok).toBeGreaterThanOrEqual(9);
    });
  }

  for (const template of office.dashboards) {
    it(`${template.id}: the right chart passes and a wrong one fails`, () => {
      let ok = 0;
      for (const seed of SEEDS) {
        const draft = template.build(makeRng(seed), generateKaveri(seed));
        if (!checkDashboard(draft).ok) continue;
        ok++;
        expect(gradeDashboard(draft.dataset, draft.spec, draft.spec).passed).toBe(true);
        const other = draft.dataset.columns.find((c) => c.type === "text" && c.name !== draft.spec.dimension)!.name;
        expect(gradeDashboard(draft.dataset, draft.spec, { ...draft.spec, dimension: other, dimension_grain: "value" }).passed).toBe(false);
      }
      expect(ok).toBeGreaterThanOrEqual(7);
    });
  }

  for (const template of KAVERI_WORLD.templates) {
    it(`${template.id}: valid for most users, and the common mistake is caught`, async () => {
      let ok = 0;
      const reasons: string[] = [];
      for (const seed of SEEDS) {
        const verdict = await validateDraft(template.build(makeRng(seed)), generateKaveri(seed), runners);
        if (verdict.ok) ok++;
        else reasons.push(verdict.reason);
      }
      expect(ok, reasons.join(" | ")).toBeGreaterThanOrEqual(7);
    }, 60_000);
  }
});
