import { describe, expect, it } from "vitest";
import { runSqlLocal } from "./local-runner";

const SEED = "CREATE TABLE t (id INTEGER, grp TEXT, v REAL); INSERT INTO t VALUES (1,'a',10),(2,'a',20),(3,'b',5);";

describe("runSqlLocal", () => {
  it("runs a query on the seed and returns columns and rows", async () => {
    const [r] = await runSqlLocal(SEED, ["SELECT grp, SUM(v) AS total FROM t GROUP BY grp ORDER BY grp"]);
    expect(r).toEqual({ columns: ["grp", "total"], rows: [["a", 30], ["b", 5]], truncated: false });
  });

  it("supports window functions", async () => {
    const [r] = await runSqlLocal(SEED, ["SELECT id, SUM(v) OVER (ORDER BY id) AS running FROM t"]);
    expect("rows" in r && r.rows.map((x) => x[1])).toEqual([10, 30, 35]);
  });

  it("returns an error object for bad SQL instead of throwing", async () => {
    const [r] = await runSqlLocal(SEED, ["SELECT nope FROM t"]);
    expect("error" in r && r.error).toMatch(/no such column/i);
  });

  it("refuses more than one statement, like the old runner", async () => {
    const [r] = await runSqlLocal(SEED, ["SELECT 1; DROP TABLE t"]);
    expect("error" in r && r.error).toMatch(/one statement/i);
  });

  it("does not mistake a semicolon inside a string for a second statement", async () => {
    const [r] = await runSqlLocal(SEED, ["SELECT 'a;b' AS s"]);
    expect("rows" in r && r.rows).toEqual([["a;b"]]);
  });

  it("gives every query a fresh database", async () => {
    const [drop, count] = await runSqlLocal(SEED, ["DROP TABLE t", "SELECT COUNT(*) FROM t"]);
    expect("error" in drop).toBe(false);
    expect("rows" in count && count.rows).toEqual([[3]]);
  });

  it("caps rows and says so", async () => {
    const [r] = await runSqlLocal("", ["WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 800) SELECT i FROM n"]);
    expect("rows" in r && r.rows.length).toBe(500);
    expect("truncated" in r && r.truncated).toBe(true);
  });

  it("stops a runaway query at the time limit and keeps serving", async () => {
    const started = Date.now();
    const [slow, ok] = await runSqlLocal(SEED, ["WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT COUNT(*) FROM r", "SELECT COUNT(*) FROM t"], { timeoutMs: 4000 });
    expect(Date.now() - started).toBeLessThan(12_000);
    expect("error" in slow && slow.error).toMatch(/too long/i);
    expect("rows" in ok && ok.rows).toEqual([[3]]);
  }, 30_000);
});

import { runSqlScript } from "./local-runner";

describe("runSqlScript", () => {
  it("runs a multi-statement script, then probes the resulting database", async () => {
    const r = await runSqlScript(SEED, "UPDATE t SET v = v * 2 WHERE grp = 'a'; CREATE INDEX idx_t_grp ON t(grp);", ["SELECT SUM(v) FROM t", "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_t_grp'"]);
    expect(r.scriptError).toBeNull();
    expect(r.probes.map((p) => ("rows" in p ? p.rows[0][0] : null))).toEqual([65, 1]);
  });

  it("lets a probe change data first (to fire a trigger) and a later probe read the effect", async () => {
    const script = "CREATE TABLE audit (id INTEGER); CREATE TRIGGER trg AFTER UPDATE ON t BEGIN INSERT INTO audit VALUES (NEW.id); END;";
    const r = await runSqlScript(SEED, script, ["UPDATE t SET v = 0 WHERE id = 2", "SELECT id FROM audit"]);
    expect(r.scriptError).toBeNull();
    expect(r.probes[1]).toEqual({ columns: ["id"], rows: [[2]], truncated: false });
  });

  it("reports a script error and runs no probes", async () => {
    const r = await runSqlScript(SEED, "UPDATE nope SET x = 1", ["SELECT 1"]);
    expect(r.scriptError).toMatch(/no such table/i);
    expect(r.probes).toEqual([]);
  });

  it("stops a script that never finishes", async () => {
    const started = Date.now();
    const r = await runSqlScript(SEED, "UPDATE t SET v = (WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r) SELECT COUNT(*) FROM r)", ["SELECT 1"], { timeoutMs: 4000 });
    expect(Date.now() - started).toBeLessThan(12_000);
    expect(r.scriptError).toMatch(/too long/i);
  }, 15000);

  it("does not let one run change another", async () => {
    await runSqlScript(SEED, "DELETE FROM t", ["SELECT 1"]);
    const r = await runSqlScript(SEED, "", ["SELECT COUNT(*) FROM t"]);
    expect("rows" in r.probes[0] && r.probes[0].rows).toEqual([[3]]);
  });
});
