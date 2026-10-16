import { expect, it } from "vitest";
import { engineOf } from "../sql/engine";
import { generateBrightCart } from "../worlds/brightcart";
import { hashSeed, makeRng } from "../rng";
import { PG_WORLD_SETUP } from "./pg-support";
import { validateDraft } from "./pick";
import type { TicketTemplate } from "./types";

// many databases start at once here, so a run is allowed much longer than in production
process.env.PG_TIMEOUT_MS ||= "90000";

/** Registers one test per template: it must build a fair ticket for most users on real PostgreSQL. */
export function checkPgTemplates(templates: readonly TicketTemplate[], seeds = 5, minOk = 3) {
  const runners = engineOf("postgres").runners;
  for (const template of templates) {
    it(`${template.id} (${template.taskKind}): fair for most users`, async () => {
      let ok = 0;
      const reasons: string[] = [];
      for (let i = 0; i < seeds; i++) {
        const seed = hashSeed("pg-tickets", template.id, i);
        const draft = template.build(makeRng(seed));
        expect(draft.scenario.length).toBeGreaterThan(40);
        const verdict = await validateDraft(draft, generateBrightCart(seed), runners, { dialect: "postgres", setupSql: PG_WORLD_SETUP });
        if (verdict.ok) ok++;
        else reasons.push(verdict.reason);
      }
      expect(ok, `rejections: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(minOk);
    }, 240_000);
  }
}
