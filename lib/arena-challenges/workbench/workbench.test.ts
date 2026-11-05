import { describe, expect, it } from "vitest";
import { compareResult, computeAnswer, computeScriptAnswer, judgeScript, publicTask, validateQuery, validateScript } from "./sql-task";
import { buildWorld, WORLD_KEYS } from "./sql-bank";
import { buildDba } from "./dba-bank";
import { DEBUG_PROGRAMS } from "./debug-bank";
import { LANG_PROGRAMS } from "./debug-bank-langs";

const answer = { expected: { columns: ["a", "b"], rows: [["x", 1], ["y", 2]] as (string | number | null)[][] } };
const result = (rows: (string | number | null)[][], columns = ["a", "b"]) => ({ columns, rows, truncated: false });

describe("compareResult", () => {
  it("ignores column names and, unless ordered, row order", () => {
    expect(compareResult(answer, result([["y", 2], ["x", 1]], ["p", "q"]), false).passed).toBe(true);
    expect(compareResult(answer, result([["y", 2], ["x", 1]]), true).passed).toBe(false);
  });
  it("rejects wrong shapes and values with a plain message", () => {
    expect(compareResult(answer, result([["x", 1]]), false).message).toMatch(/1 row/);
    expect(compareResult(answer, result([["x", 1, 9], ["y", 2, 9]], ["a", "b", "c"]), false).message).toMatch(/3 columns/);
    expect(compareResult(answer, result([["x", 1], ["y", 3]]), false).passed).toBe(false);
    expect(compareResult(answer, { error: "no such table" }, false).message).toMatch(/failed/);
  });
});

describe("query and script validation", () => {
  it("allows one read-only statement for queries", () => {
    expect(validateQuery("SELECT 1;")).toBeNull();
    expect(validateQuery("DELETE FROM t")).not.toBeNull();
    expect(validateQuery("SELECT 1; SELECT 2")).not.toBeNull();
  });
  it("blocks reaching outside the task database in scripts", () => {
    expect(validateScript("CREATE INDEX i ON t(a);")).toBeNull();
    expect(validateScript("ATTACH DATABASE 'x' AS y")).not.toBeNull();
    expect(validateScript("PRAGMA foreign_keys = off")).not.toBeNull();
  });
});

describe("task banks", () => {
  it("builds every dataset, with the same tasks for the same seed", () => {
    for (const w of WORLD_KEYS) {
      const a = buildWorld(w, 1);
      expect(a.length).toBeGreaterThanOrEqual(9);
      expect(JSON.stringify(buildWorld(w, 1))).toBe(JSON.stringify(a));
    }
  });
  it("computes an answer for a SQL task and keeps it out of the public view", async () => {
    const t = buildWorld("shop", 1)[0];
    const r = await computeAnswer(t);
    expect("answer" in r).toBe(true);
    expect(JSON.stringify(publicTask(t))).not.toContain(t.query);
  });
  it("accepts a DBA reference script, rejects doing nothing, and compares text exactly", async () => {
    const t = buildDba(1).find((x) => x.title === "Clean up the email column")!;
    const r = await computeScriptAnswer(t.tables, t.setupSql, t.script, t.probes);
    if ("reason" in r) throw new Error(r.reason);
    const task = { ...publicTask({ ...t, query: "", ordered: false }), mode: "script" as const, previewQuery: t.previewQuery };
    expect((await judgeScript(task, r.answer, t.script)).verdict.passed).toBe(true);
    expect((await judgeScript(task, r.answer, "SELECT 1;")).verdict.passed).toBe(false);
    expect((await judgeScript(task, r.answer, "UPDATE contacts SET email = lower(email);")).verdict.passed).toBe(false);
  });
  it("every language port names a Python task and every bug text exists in its program", () => {
    for (const p of LANG_PROGRAMS) {
      expect(DEBUG_PROGRAMS.some((d) => d.title === p.ref), p.ref).toBe(true);
      for (const b of p.bugs) expect(p.code.includes(b.find), `${p.lang} ${p.ref}: ${b.find}`).toBe(true);
    }
    for (const d of DEBUG_PROGRAMS) for (const b of d.bugs) expect(d.code.includes(b.find), `${d.title}: ${b.find}`).toBe(true);
  });
});
