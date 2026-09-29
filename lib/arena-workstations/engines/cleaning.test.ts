import { describe, expect, it } from "vitest";
import { applySteps, compareCleanTables, noOpSteps, parseDate, parseNumber, type CleaningStep } from "./cleaning";
import type { Dataset } from "./dataset";

const raw: Dataset = {
  name: "orders",
  columns: [
    { name: "order_id", type: "text" },
    { name: "city", type: "text" },
    { name: "amount", type: "number" },
    { name: "order_date", type: "date" },
  ],
  rows: [
    ["A1", " Mumbai ", "₹1,200", "03/08/2026"],
    ["A2", "mumbai", "450", "04/08/2026"],
    ["A2", "mumbai", "450", "04/08/2026"],
    ["A3", "DELHI", null, "05/08/2026"],
    ["A4", "delhi", "abc", "31/02/2026"],
  ],
};

const expectedSteps: CleaningStep[] = [
  { op: "dedupe", columns: ["order_id"] },
  { op: "trim", column: "city" },
  { op: "titlecase", column: "city" },
  { op: "to_number", column: "amount" },
  { op: "drop_missing", column: "amount" },
  { op: "to_date", column: "order_date", format: "DD/MM/YYYY" },
];

describe("cleaning engine", () => {
  it("parses messy numbers and dates", () => {
    expect(parseNumber("₹1,200")).toBe(1200);
    expect(parseNumber(" 45.5 ")).toBe(45.5);
    expect(parseNumber("Rs. 99")).toBe(99);
    expect(parseNumber("abc")).toBeNull();
    expect(parseDate("03/08/2026", "DD/MM/YYYY")).toBe("2026-08-03");
    expect(parseDate("08/03/2026", "MM/DD/YYYY")).toBe("2026-08-03");
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
    expect(parseDate("2026-08-03", "DD/MM/YYYY")).toBe("2026-08-03");
  });

  it("applies the expected steps", () => {
    const clean = applySteps(raw, expectedSteps);
    expect(clean.rows).toEqual([
      ["A1", "Mumbai", 1200, "2026-08-03"],
      ["A2", "Mumbai", 450, "2026-08-04"],
    ]);
  });

  it("accepts a different step order that yields the same table", () => {
    const alt: CleaningStep[] = [
      { op: "to_number", column: "amount" },
      { op: "drop_missing", column: "amount" },
      { op: "trim", column: "city" },
      { op: "titlecase", column: "city" },
      { op: "to_date", column: "order_date", format: "DD/MM/YYYY" },
      { op: "dedupe", columns: ["order_id"] },
    ];
    expect(compareCleanTables(applySteps(raw, expectedSteps), applySteps(raw, alt)).passed).toBe(true);
  });

  it("fails when a requirement is missed (duplicates kept)", () => {
    const missed = expectedSteps.filter((s) => s.op !== "dedupe");
    const res = compareCleanTables(applySteps(raw, expectedSteps), applySteps(raw, missed));
    expect(res.passed).toBe(false);
    expect(res.extraRows).toBe(1);
  });

  it("fails when casing is wrong (text compares exactly)", () => {
    const wrong = expectedSteps.map((s) => (s.op === "titlecase" ? ({ op: "lowercase", column: "city" } as CleaningStep) : s));
    expect(compareCleanTables(applySteps(raw, expectedSteps), applySteps(raw, wrong)).passed).toBe(false);
  });

  it("flags no-op steps", () => {
    expect(noOpSteps(raw, [{ op: "lowercase", column: "order_id" }])).toEqual([]);
    expect(noOpSteps(raw, [{ op: "replace", column: "city", from: "Pune", to: "pune" }])).toEqual([0]);
  });

  it("rejects unknown columns", () => {
    expect(() => applySteps(raw, [{ op: "trim", column: "nope" }])).toThrow(/Unknown column/);
  });
});
