import { describe, expect, it } from "vitest";
import { buildLayout, computeExpectedCells, gradeSpreadsheet, mergeSubmission, type SpreadsheetContent } from "./spreadsheet";

const content: SpreadsheetContent = {
  data: {
    name: "sales",
    columns: [
      { name: "sku", type: "text" },
      { name: "region", type: "text" },
      { name: "units", type: "number" },
      { name: "unit_price", type: "number" },
    ],
    rows: [
      ["S1", "North", 3, 100],
      ["S2", "South", 5, 40],
      ["S3", "North", 2, 250],
    ],
  },
  lookup: { name: "tax", columns: [{ name: "region", type: "text" }, { name: "tax_rate", type: "number" }], rows: [["North", 0.18], ["South", 0.12]] },
  tasks: [
    { type: "row_formula", header: "revenue", op: "multiply", left: "units", right: "unit_price", decimals: 0 },
    { type: "lookup", header: "tax_rate", key_column: "region" },
    { type: "summary", label: "Total units", fn: "SUM", column: "units", decimals: 0 },
    { type: "conditional_summary", label: "North units", fn: "SUMIF", criteria_column: "region", criteria_value: "North", column: "units", decimals: 0 },
  ],
};

describe("spreadsheet tasks", () => {
  const layout = buildLayout(content);
  const key = computeExpectedCells(content, layout);

  it("lays out data, task columns, lookup table and summary block", () => {
    expect(layout.cells.A1).toBe("sku");
    expect(layout.cells.E1).toBe("revenue");
    expect(layout.cells.F1).toBe("tax_rate");
    expect(layout.cells.H1).toBe("region"); // lookup table after one gap column
    expect(layout.cells.A6).toBe("Total units");
    expect(layout.targets[0].cells).toEqual(["E2", "E3", "E4"]);
    expect(layout.targets[2].cells).toEqual(["B6"]);
    expect(layout.targets[0].instruction).toMatch(/units \(column C\) × unit_price \(column D\)/);
  });

  it("computes expected values from the data", () => {
    expect(key).toMatchObject({ E2: 300, E3: 200, E4: 500, F2: 0.18, F3: 0.12, F4: 0.18, B6: 10, B7: 5 });
  });

  const correct = {
    E2: "=C2*D2", E3: "=C3*D3", E4: "=C4*D4",
    F2: "=VLOOKUP(B2,$H$2:$I$3,2,FALSE)", F3: "=VLOOKUP(B3,$H$2:$I$3,2,FALSE)", F4: "=VLOOKUP(B4,$H$2:$I$3,2,FALSE)",
    B6: "=SUM(C2:C4)", B7: '=SUMIF(B2:B4,"North",C2:C4)',
  };

  it("passes correct formulas", () => {
    expect(gradeSpreadsheet(content, key, correct).passed).toBe(true);
  });

  it("fails hardcoded numbers even when the value is right", () => {
    const res = gradeSpreadsheet(content, key, { ...correct, B6: "10" });
    expect(res.passed).toBe(false);
  });

  it("fails an incorrect formula", () => {
    expect(gradeSpreadsheet(content, key, { ...correct, E3: "=C3+D3" }).passed).toBe(false);
  });

  it("requires lookups to return exactly the stored value", () => {
    expect(gradeSpreadsheet(content, key, { ...correct, F2: "=I3" }).passed).toBe(false); // 0.12 instead of 0.18
  });

  it("ignores attempts to overwrite the locked data", () => {
    const sheet = mergeSubmission(layout, { C2: "999", B6: "=SUM(C2:C4)" });
    expect(sheet.C2).toBe("3");
    expect(gradeSpreadsheet(content, key, { ...correct, C2: "999", C3: "0" }).passed).toBe(true);
  });

  it("allows helper cells outside the locked area", () => {
    expect(gradeSpreadsheet(content, key, { ...correct, K1: "=SUM(C2:C4)", B6: "=K1" }).passed).toBe(true);
  });

  it("refuses data that can't support a task", () => {
    const bad: SpreadsheetContent = { ...content, tasks: [{ type: "conditional_summary", label: "x", fn: "SUMIF", criteria_column: "region", criteria_value: "East", column: "units", decimals: 0 }] };
    expect(() => computeExpectedCells(bad, buildLayout(bad))).toThrow(/no rows/);
  });
});
