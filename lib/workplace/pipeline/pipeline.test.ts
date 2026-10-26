import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { expectedTable, gradePipeline, isDaily, taskOrder } from "./checks";
import { buildSource, ORDERS, type Scenario } from "./scenario";
import { parseSpec } from "./spec";
import { simulate } from "./simulate";
import { PIPELINE_TEMPLATES } from "./templates";

const ALL: Scenario = { seed: 7, dataset: ORDERS, late: true, updates: true, drift: true, flaky: 2, bad: true };
const good = {
  schedule: "@daily",
  source: "raw_orders",
  target: { table: "fact_orders", partition_by: "order_date", format: "parquet" },
  load: { mode: "incremental", watermark: "ingested_at", write: "merge", unique_key: "order_id", order_by: "updated_at", on_schema_change: "append_new_columns" },
  quality: { on_fail: "block", checks: [{ check: "not_null", column: "order_id" }, { check: "min", column: "amount_inr", value: 0 }] },
  tasks: [{ id: "extract" }, { id: "quality", depends_on: ["extract"] }, { id: "load", depends_on: ["quality"] }],
  retries: { max: 3, delay_minutes: 5 },
};
const run = (o: object) => {
  const p = parseSpec(stringify(o));
  if (!p.ok) throw new Error(p.error);
  return simulate(p.spec, ALL);
};

describe("pipeline source", () => {
  it("is deterministic and has the late, re-sent, drifted and corrupt rows it promises", () => {
    const a = buildSource(ALL);
    expect(buildSource(ALL)).toEqual(a);
    expect(a.batches.map((b) => b.day)).toEqual([1, 2, 3, 4]);
    expect(a.lateKeys).toHaveLength(2);
    expect(a.driftKeys).toHaveLength(8);
    expect(a.batches[3].rows.every((r) => r.order_id === null || (r.amount_inr as number) < 0)).toBe(true);
    // the corrupt day is excluded and re-sent rows collapse to their newest version
    expect(expectedTable(ALL).size).toBe(8 * 3 + 2);
  });
});

describe("pipeline simulator", () => {
  it("a sound spec loads everything once, blocks the corrupt day and survives a backfill", () => {
    const sim = run(good);
    expect(sim.errors).toEqual([]);
    expect(sim.runs.map((r) => r.status)).toEqual(["success", "success", "success", "blocked"]);
    expect(sim.runs[2].attempts).toBe(3);
    expect(sim.summary.duplicateKeys).toBe(0);
    expect(sim.summary.columns).toContain("coupon_code");
    expect(sim.rerunSame).toBe(true);
    expect(sim.pruning.scanned).toBe(sim.pruning.needed);
  });

  it("append duplicates rows, and a backfill changes the table", () => {
    const sim = run({ ...good, load: { ...good.load, write: "append" } });
    expect(sim.summary.duplicateKeys).toBeGreaterThan(0);
    expect(sim.rerunSame).toBe(false);
  });

  it("an updated_at watermark without lookback misses late rows; a lookback finds them", () => {
    const late = buildSource(ALL).lateKeys;
    const has = (rows: { order_id: unknown }[]) => late.every((k) => rows.some((r) => r.order_id === k));
    expect(has(run({ ...good, load: { ...good.load, watermark: "updated_at" } }).final as never)).toBe(false);
    expect(has(run({ ...good, load: { ...good.load, watermark: "updated_at", lookback_hours: 24 } }).final as never)).toBe(true);
  });

  it("fails the flaky day without enough retries, and fails or drops on schema change as told", () => {
    expect(run({ ...good, retries: { max: 1, delay_minutes: 5 } }).runs[2].status).toBe("failed");
    expect(run({ ...good, load: { ...good.load, on_schema_change: "fail" } }).runs[2].reason).toMatch(/schema changed/);
    expect(run({ ...good, load: { ...good.load, on_schema_change: "ignore" } }).summary.columns).not.toContain("coupon_code");
  });

  it("a warn-only gate lets the corrupt rows in", () => {
    const sim = run({ ...good, quality: { ...good.quality, on_fail: "warn" } });
    expect(sim.summary.nullKeys).toBeGreaterThan(0);
  });

  it("reports spec problems instead of running", () => {
    expect(run({ ...good, source: "orders" }).errors[0]).toMatch(/source must be raw_orders/);
    expect(run({ ...good, load: { mode: "incremental", write: "merge" } }).errors.join()).toMatch(/watermark.*unique_key|unique_key/);
  });
});

describe("pipeline checks", () => {
  it("orders tasks and finds cycles and missing dependencies", () => {
    expect(taskOrder([{ id: "a" }, { id: "b", depends_on: ["a"] }])).toEqual(["a", "b"]);
    expect(taskOrder([{ id: "a", depends_on: ["b"] }, { id: "b", depends_on: ["a"] }])).toBeNull();
    expect(taskOrder([{ id: "a", depends_on: ["zzz"] }])).toBeNull();
  });

  it("knows a daily schedule", () => {
    expect(["@daily", "30 1 * * *", "0 0 * * *"].map(isDaily)).toEqual([true, true, true]);
    expect(["every night", "*/5 * * * *", "0 1 * * 1", "61 1 * * *", undefined].map(isDaily)).toEqual([false, false, false, false, false]);
  });

  it("fails every check on unreadable YAML and on an empty file, with a reason", () => {
    const t = PIPELINE_TEMPLATES[0];
    for (const text of ["load: [unclosed", ""]) {
      const g = gradePipeline(text, t.draft.key.scenario, t.draft.key.checks);
      expect(g.checks.every((c) => !c.passed)).toBe(true);
      expect(g.error).toBeTruthy();
    }
  });

  it("rejects unbounded retries", () => {
    const t = PIPELINE_TEMPLATES.find((x) => x.id === "pipe-flaky-extract")!;
    const unbounded = t.solution.replace("max: 3", "max: forever");
    const g = gradePipeline(unbounded, t.draft.key.scenario, t.draft.key.checks);
    expect(g.checks.find((c) => c.label.startsWith("Retries"))!.passed).toBe(false);
  });
});

describe("fixed pipeline tickets", () => {
  it("cover each area with an easy fresher ticket", () => {
    for (const area of ["pipelines", "data-quality", "partitioning-and-storage"]) {
      expect(PIPELINE_TEMPLATES.some((t) => t.areas.includes(area) && t.difficulty === "easy" && t.minLevel === "fresher")).toBe(true);
    }
    expect(PIPELINE_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  for (const t of PIPELINE_TEMPLATES) {
    it(`${t.id}: the solution passes every check and the starter fails at least two`, () => {
      const { scenario, checks } = t.draft.key;
      const solved = gradePipeline(t.solution, scenario, checks);
      expect(solved.error).toBeNull();
      expect(solved.checks.filter((c) => !c.passed).map((c) => c.label)).toEqual([]);
      const starter = gradePipeline(t.draft.content.file.content, scenario, checks);
      expect(starter.checks.filter((c) => !c.passed).length).toBeGreaterThanOrEqual(2);
      expect(t.draft.content.requirements).toEqual(checks.map((c) => c.label));
      expect(JSON.stringify(t.draft.content)).not.toContain(t.solution);
    });
  }
});
