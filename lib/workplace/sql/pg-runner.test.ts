import { describe, expect, it } from "vitest";
import { runPgQueries, runPgScript } from "./pg-runner";

// the whole suite starts many databases at once, so a run is allowed longer than in production
process.env.PG_TIMEOUT_MS ||= "90000";

const SEED = `CREATE TABLE t (id INTEGER, grp TEXT, v REAL); INSERT INTO t VALUES (1,'a',10),(2,'a',20),(3,'b',5);`;
const T = 30_000;

describe("Postgres runner (PGlite)", () => {
  it("is real PostgreSQL and returns columns and rows", async () => {
    const [v, r] = await runPgQueries(SEED, ["SELECT current_setting('server_version_num')::int >= 160000 AS modern", "SELECT grp, SUM(v) AS total FROM t GROUP BY grp ORDER BY grp"]);
    expect("rows" in v && v.rows).toEqual([[true]]);
    expect(r).toEqual({ columns: ["grp", "total"], rows: [["a", 30], ["b", 5]], truncated: false });
  }, T);

  it("reports an error as a result, not an exception", async () => {
    const [r] = await runPgQueries(SEED, ["SELECT nope FROM t"]);
    expect("error" in r && r.error).toMatch(/column "nope" does not exist/i);
  }, T);

  it("runs a script that makes a stored function, then calls it with probes", async () => {
    const script = `CREATE FUNCTION tax(amount numeric, pct numeric DEFAULT 18) RETURNS numeric LANGUAGE plpgsql AS $$ BEGIN RETURN ROUND(amount * pct / 100, 2); END $$;`;
    const r = await runPgScript(SEED, script, ["SELECT tax(100)", "SELECT tax(250, 5)"]);
    expect(r.scriptError).toBeNull();
    expect(r.probes.map((p) => ("rows" in p ? Number(p.rows[0][0]) : null))).toEqual([18, 12.5]);
  }, T);

  it("lets a probe change data first (to fire a trigger) and a later one read the effect", async () => {
    const script = `CREATE TABLE audit (id INTEGER);
      CREATE FUNCTION log_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO audit VALUES (NEW.id); RETURN NEW; END $$;
      CREATE TRIGGER trg AFTER UPDATE ON t FOR EACH ROW EXECUTE FUNCTION log_change();`;
    const r = await runPgScript(SEED, script, ["UPDATE t SET v = 0 WHERE id = 2", "SELECT id FROM audit"]);
    expect(r.scriptError).toBeNull();
    expect(r.probes[1]).toEqual({ columns: ["id"], rows: [[2]], truncated: false });
  }, T);

  it("reports a script error and runs no probes", async () => {
    const r = await runPgScript(SEED, "UPDATE nope SET x = 1", ["SELECT 1"]);
    expect(r.scriptError).toMatch(/relation "nope" does not exist/i);
    expect(r.probes).toEqual([]);
  }, T);

  it("stops a script that never finishes", async () => {
    const started = Date.now();
    const r = await runPgScript(SEED, "DO $$ BEGIN LOOP PERFORM 1; END LOOP; END $$;", ["SELECT 1"], { timeoutMs: 2500 });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(r.scriptError).toMatch(/too long/i);
  }, T);

  it("gives every call a fresh database", async () => {
    await runPgScript(SEED, "DROP TABLE t", ["SELECT 1"]);
    const [r] = await runPgQueries(SEED, ["SELECT COUNT(*)::int FROM t"]);
    expect("rows" in r && r.rows).toEqual([[3]]);
  }, T);

  it("caps rows and says so", async () => {
    const [r] = await runPgQueries("", ["SELECT g FROM generate_series(1, 800) g"]);
    expect("rows" in r && r.rows.length).toBe(500);
    expect("truncated" in r && r.truncated).toBe(true);
  }, T);
});
