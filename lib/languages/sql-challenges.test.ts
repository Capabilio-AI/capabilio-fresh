import { describe, expect, it } from "vitest";
import { sqlTrack } from "./sql";
import { judgeSqlChallenge } from "./sql-judge";
import { isSqlChallenge, type SqlChallenge } from "./types";

const challenges = sqlTrack.modules.flatMap((m) => (m.challenge && isSqlChallenge(m.challenge) ? [[m.key, m.challenge] as const] : []));

describe("SQL module problems", () => {
  it("cover every SQL module", () => expect(challenges.map(([k]) => k)).toEqual(sqlTrack.modules.map((m) => m.key)));

  it.each(challenges)("%s: every dataset has the same tables and columns, with a small visible one", (_k, c: SqlChallenge) => {
    expect(c.datasets.length).toBeGreaterThanOrEqual(3);
    const shape = (d: SqlChallenge["datasets"][number]) => JSON.stringify(d.map((t) => [t.name, t.columns.map((x) => x.name)]));
    for (const d of c.datasets) expect(shape(d)).toBe(shape(c.datasets[0]));
    for (const t of c.datasets[0]) expect(t.rows.length).toBeLessThanOrEqual(15);
    if (c.mode === "script") expect(c.probes.length).toBeGreaterThanOrEqual(2);
  });

  it.each(challenges)("%s: the reference passes on every dataset", async (_k, c: SqlChallenge) => {
    const r = await judgeSqlChallenge(c, c.reference, "submit");
    expect(r.rows.map((x) => x.message).filter(Boolean)).toEqual([]);
    expect(r.passed).toBe(true);
  }, 60_000);

  it.each(challenges)("%s: every common mistake is caught on some dataset", async (_k, c: SqlChallenge) => {
    expect(c.commonMistakes.length).toBeGreaterThanOrEqual(2);
    for (const wrong of c.commonMistakes) {
      const r = await judgeSqlChallenge(c, wrong, "submit");
      expect(r.passed, `this mistake slipped through: ${wrong}`).toBe(false);
    }
  }, 60_000);
});
