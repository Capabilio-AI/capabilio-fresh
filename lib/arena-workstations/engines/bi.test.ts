import { describe, expect, it } from "vitest";
import { BiSpecSchema, evaluateSpec, gradeDashboard, type BiSpec } from "./bi";
import type { Dataset } from "./dataset";

const ds: Dataset = {
  name: "orders",
  columns: [
    { name: "order_date", type: "date" },
    { name: "region", type: "text" },
    { name: "status", type: "text" },
    { name: "revenue", type: "number" },
  ],
  rows: [
    ["2026-06-03", "North", "delivered", 100],
    ["2026-06-15", "South", "delivered", 200],
    ["2026-07-02", "North", "cancelled", 50],
    ["2026-07-09", "North", "delivered", 300],
    ["2026-08-11", "South", "delivered", 400],
  ],
};

const spec = (over: Partial<BiSpec>): BiSpec => BiSpecSchema.parse({ chart_type: "line", dimension: "order_date", dimension_grain: "month", measure: "revenue", aggregation: "sum", filters: [{ column: "status", operator: "=", value: "delivered" }], ...over });

describe("BI engine", () => {
  it("evaluates a monthly revenue trend with a filter", () => {
    expect(evaluateSpec(ds, spec({}))).toEqual([
      { label: "2026-06", value: 300 },
      { label: "2026-07", value: 300 },
      { label: "2026-08", value: 400 },
    ]);
  });

  it("passes the correct chart", () => {
    expect(gradeDashboard(ds, spec({}), spec({})).passed).toBe(true);
  });

  it("passes an equivalent spec (bar is acceptable for a time series; != cancelled filters the same rows)", () => {
    const alt = spec({ chart_type: "bar", filters: [{ column: "status", operator: "!=", value: "cancelled" }] });
    expect(gradeDashboard(ds, spec({}), alt).passed).toBe(true);
  });

  it("fails a wrong chart type", () => {
    const res = gradeDashboard(ds, spec({}), spec({ chart_type: "pie" }));
    expect(res.passed).toBe(false);
    expect(res.checks.find((c) => c.label.startsWith("Chart"))!.passed).toBe(false);
  });

  it("fails a wrong aggregation or missing filter", () => {
    expect(gradeDashboard(ds, spec({}), spec({ aggregation: "avg" })).passed).toBe(false);
    expect(gradeDashboard(ds, spec({}), spec({ filters: [] })).passed).toBe(false);
  });

  it("checks order when the request is a top-N", () => {
    const expected = spec({ chart_type: "bar", dimension: "region", dimension_grain: "value", sort: "measure_desc", limit: 1 });
    expect(gradeDashboard(ds, expected, spec({ chart_type: "bar", dimension: "region", dimension_grain: "value", sort: "measure_desc", limit: 1 })).passed).toBe(true);
    expect(gradeDashboard(ds, expected, spec({ chart_type: "bar", dimension: "region", dimension_grain: "value", sort: "measure_asc", limit: 1 })).passed).toBe(false);
  });

  it("reports an unbuildable candidate chart instead of throwing", () => {
    const res = gradeDashboard(ds, spec({}), spec({ measure: "region" }));
    expect(res.passed).toBe(false);
    expect(res.message).toMatch(/can't be built/);
  });
});

describe("quick measures", () => {
  const ds: Dataset = {
    name: "sales",
    columns: [{ name: "month", type: "text" }, { name: "region", type: "text" }, { name: "revenue", type: "number" }, { name: "units", type: "number" }],
    rows: [["2026-01", "N", 100, 10], ["2026-01", "S", 300, 10], ["2026-02", "N", 200, 40], ["2026-03", "N", 400, 20], ["2026-03", "S", 0, 0]],
  };
  const base: BiSpec = { chart_type: "bar", dimension: "region", dimension_grain: "value", measure: "revenue", aggregation: "sum", quick: "none", measure2: null, filters: [], sort: "dimension_asc", limit: null };

  it("percent of total adds up to 100 and is a share of the filtered data", () => {
    const pts = evaluateSpec(ds, { ...base, quick: "percent_of_total" });
    expect(pts).toEqual([{ label: "N", value: 70 }, { label: "S", value: 30 }]);
  });

  it("running total accumulates along the axis in label order, whatever the final sort", () => {
    const pts = evaluateSpec(ds, { ...base, dimension: "month", quick: "running_total", sort: "measure_desc" });
    expect(pts.map((p) => [p.label, p.value])).toEqual([["2026-03", 1000], ["2026-02", 600], ["2026-01", 400]]);
  });

  it("a ratio divides the totals, not the average of the rows, and skips groups with no denominator", () => {
    const pts = evaluateSpec(ds, { ...base, dimension: "month", quick: "ratio", measure2: "units" });
    expect(pts.find((p) => p.label === "2026-01")!.value).toBe(20); // (100+300)/(10+10), not mean(10, 30)
    const empty = evaluateSpec({ ...ds, rows: [["2026-03", "S", 0, 0]] }, { ...base, dimension: "month", quick: "ratio", measure2: "units" });
    expect(empty).toEqual([]);
  });

  it("rejects combinations that are not meaningful", () => {
    expect(() => evaluateSpec(ds, { ...base, aggregation: "avg", quick: "percent_of_total" })).toThrow(/total or a count/);
    expect(() => evaluateSpec(ds, { ...base, quick: "ratio" })).toThrow(/ratio needs/);
  });

  it("grades a candidate that picks the wrong quick measure as a value mismatch", () => {
    const want = { ...base, quick: "percent_of_total" as const };
    expect(gradeDashboard(ds, want, want).passed).toBe(true);
    const wrong = gradeDashboard(ds, want, base);
    expect(wrong.passed).toBe(false);
    expect(wrong.checks.find((c) => c.label.startsWith("Values"))!.passed).toBe(false);
  });

  it("old saved specs without the new fields still parse as plain measures", () => {
    const parsed = BiSpecSchema.parse({ chart_type: "bar", dimension: "region", measure: "revenue", aggregation: "sum" });
    expect(parsed.quick).toBe("none");
    expect(parsed.measure2).toBeNull();
  });
});
