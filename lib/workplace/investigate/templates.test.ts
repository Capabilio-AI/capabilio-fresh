import { describe, expect, it } from "vitest";
import { generateBrightCart } from "../worlds/brightcart";
import { hashSeed, makeRng } from "../rng";
import { checkInvestigation } from "./check";
import { INVESTIGATION_TEMPLATES } from "./templates";

const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("investigate-test", i));

describe("investigation tickets on the company data", () => {
  it("has detective tickets for the investigation area and incidents for the incident area, in more than one difficulty", () => {
    expect(INVESTIGATION_TEMPLATES.filter((t) => t.areas.includes("investigation")).length).toBe(3);
    expect(INVESTIGATION_TEMPLATES.filter((t) => t.areas.includes("incident")).length).toBe(4);
    expect(new Set(INVESTIGATION_TEMPLATES.map((t) => t.difficulty)).size).toBeGreaterThan(1);
  });

  for (const template of INVESTIGATION_TEMPLATES) {
    it(`${template.id}: buildable for most users, with answers that fit the form and a fault that is really in the data`, () => {
      let ok = 0;
      for (const seed of SEEDS) {
        const clean = generateBrightCart(seed);
        const before = JSON.stringify(clean);
        const draft = template.build(makeRng(seed), clean);
        expect(JSON.stringify(clean), "the clean warehouse must not be changed").toBe(before);
        if (!draft) continue;
        const verdict = checkInvestigation(draft);
        expect(verdict.ok, verdict.ok ? "" : verdict.reason).toBe(true);
        expect(draft.scenario.length).toBeGreaterThan(60);
        expect(JSON.stringify(draft.tables)).not.toBe(before);
        ok++;
      }
      expect(ok).toBeGreaterThanOrEqual(6);
    });
  }
});
