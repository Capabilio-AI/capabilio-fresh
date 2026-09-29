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
