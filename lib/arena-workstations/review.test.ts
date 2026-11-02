import { describe, expect, it } from "vitest";
import { reviewSubmission } from "./review";

const flat = (t: string, s: unknown, c?: unknown) => reviewSubmission(t, s, c).flatMap((x) => [x.title, ...x.lines]).join("\n");

describe("the last look before a final submission", () => {
  it("shows the whole query and the note", () => {
    const out = flat("sql_workspace", { query: "SELECT city, SUM(total)\nFROM orders\nGROUP BY city", note: "Pune leads" });
    expect(out).toContain("SELECT city, SUM(total)\nFROM orders\nGROUP BY city");
    expect(out).toContain("Pune leads");
  });

  it("lists every formula, not the first few, and the pivot setup", () => {
    const cells = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`F${i + 2}`, `=C${i + 2}*D${i + 2}`]));
    const out = flat("spreadsheet_workspace", { cells, pivots: { "1": { rows: "category", values: "quantity", fn: "SUM" } } });
    expect(out).toContain("Your formulas (30)");
    expect(out).toContain("F31: =C31*D31");
    expect(out).toContain("PivotTable 2: rows category, SUM of quantity");
  });

  it("says plainly when nothing was written", () => {
    expect(flat("spreadsheet_workspace", { cells: {} })).toContain("(no formulas written)");
    expect(flat("cleaning_workspace", { steps: [] })).toContain("(no steps applied)");
  });

  it("describes a chart in words, including a DAX measure and the takeaway", () => {
    const out = flat("dashboard_workspace", { spec: { chart_type: "bar", dimension: "city", dimension_grain: "value", measure: null, aggregation: "sum", quick: "none", dax: "DIVIDE([a],[b])", filters: [{ column: "status", operator: "=", value: "delivered" }], sort: "measure_desc", limit: 3 }, note: "Chennai leads" });
    expect(out).toContain("Type: bar");
    expect(out).toContain("DAX measure: DIVIDE([a],[b])");
    expect(out).toContain("status = delivered");
    expect(out).toContain("top 3");
    expect(out).toContain("Chennai leads");
  });

  it("uses the task's own labels for answer fields", () => {
    const content = { questions: [{ id: "q1", fields: [{ key: "q1.value", label: "Mean" }] }] };
    expect(flat("statistics_workspace", { answers: { "q1.value": "12.5" } }, content)).toContain("Q1: Mean: 12.5");
    expect(flat("investigation_workspace", { answers: { channel: "web" } }, { fields: [{ key: "channel", label: "Which channel?" }] })).toContain("Which channel?: web");
  });

  it("shows a blank answer as blank instead of hiding it", () => {
    expect(flat("investigation_workspace", { answers: { impact: "" } })).toContain("impact: (blank)");
  });

  it("falls back to the raw answer for a tool it does not know, and to nothing for a malformed one", () => {
    expect(flat("something_new", { a: 1 })).toContain('"a": 1');
    expect(reviewSubmission("sql_workspace", null)).toEqual([]);
  });
});
