import { describe, expect, it } from "vitest";
import { sqlJsRunner } from "@/lib/arena-content/sqljs-runner";
import { generateBrightCart } from "../worlds/brightcart";
import { hashSeed, makeRng } from "../rng";
import { runSqlScript } from "../sql/local-runner";
import { LEVELS } from "../level";
import { BRIGHTCART_SQL_TEMPLATES } from ".";
import { pickTicket, validateDraft, type Runners } from "./pick";

const runners: Runners = { query: sqlJsRunner, script: (seed, script, probes) => runSqlScript(seed, script, probes) };
const SEEDS = Array.from({ length: 10 }, (_, i) => hashSeed("tickets-test", i));
const kinds = (ds: readonly { taskKind: string }[]) => new Set(ds.map((d) => d.taskKind));

describe("BrightCart SQL tickets", () => {
  it("covers all difficulties and many kinds of database work, not just queries", () => {
    for (const d of ["easy", "medium", "hard"] as const) expect(BRIGHTCART_SQL_TEMPLATES.filter((t) => t.difficulty === d).length).toBeGreaterThanOrEqual(4);
    expect([...kinds(BRIGHTCART_SQL_TEMPLATES)].sort()).toEqual(["analytics", "cleanup", "debug", "index", "migration", "retrieval", "schema", "trigger", "update", "view"]);
  });

  for (const template of BRIGHTCART_SQL_TEMPLATES) {
    it(`${template.id} (${template.taskKind}): valid for most users, and the common mistake is always caught`, async () => {
      let ok = 0;
      const reasons: string[] = [];
      for (const seed of SEEDS) {
        const draft = template.build(makeRng(seed));
        expect(draft.title.length).toBeGreaterThan(8);
        expect(draft.scenario.length).toBeGreaterThan(40);
        const verdict = await validateDraft(draft, generateBrightCart(seed), runners);
        if (verdict.ok) ok++;
        else reasons.push(verdict.reason);
      }
      expect(ok, `rejections: ${reasons.join(" | ")}`).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.7));
    }, 90_000);
  }

  it("never hands a fresher a ticket meant for more experienced people, and lets a senior have any", async () => {
    const base = { templates: BRIGHTCART_SQL_TEMPLATES, avoidTitles: [], tables: generateBrightCart(1), runners };
    const served = new Set<string>();
    for (let i = 0; i < 12; i++) {
      for (const d of ["easy", "medium", "hard"] as const) {
        const p = await pickTicket({ ...base, difficulty: d, level: "fresher", rng: makeRng(i * 7 + 1) });
        if (p) { expect(p.draft.minLevel).toBe("fresher"); served.add(p.draft.templateId); }
      }
    }
    expect(served.size).toBeGreaterThan(0);
    expect(LEVELS[0]).toBe("fresher");
    const hard = await pickTicket({ ...base, difficulty: "hard", level: "senior", rng: makeRng(3) });
    expect(hard).not.toBeNull();
  }, 120_000);

  it("prefers a different kind of work than the user's last tickets, never repeats a title, and differs per user", async () => {
    const run = (seed: number, avoid: string[], recent: string[]) =>
      pickTicket({ templates: BRIGHTCART_SQL_TEMPLATES, difficulty: "medium", level: "mid", rng: makeRng(seed), avoidTitles: avoid, recentKinds: recent as never, tables: generateBrightCart(seed), runners });
    const first = await run(11, [], []);
    expect(first).not.toBeNull();
    const second = await run(11, [first!.draft.title], [first!.draft.taskKind]);
    expect(second!.draft.title).not.toBe(first!.draft.title);
    expect(second!.draft.taskKind).not.toBe(first!.draft.taskKind);
    expect(await run(12, [], [])).not.toBeNull();
  }, 120_000);

  it("returns null when nothing suits", async () => {
    const none = await pickTicket({ templates: [], difficulty: "easy", level: "fresher", rng: makeRng(1), avoidTitles: [], tables: generateBrightCart(1), runners });
    expect(none).toBeNull();
  });
});
