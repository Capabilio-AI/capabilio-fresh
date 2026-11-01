import { describe, expect, it } from "vitest";
import { DaxError, evaluateMeasure, parseDax, type ContextFilter } from "./dax";
import type { Dataset } from "./dataset";

const ds: Dataset = {
  name: "sales",
  columns: [{ name: "city", type: "text" }, { name: "status", type: "text" }, { name: "quantity", type: "number" }, { name: "price", type: "number" }, { name: "customer", type: "text" }],
  rows: [
    ["Pune", "delivered", 2, 100, "a"], ["Pune", "returned", 1, 100, "a"], ["Pune", "delivered", 3, 50, "b"],
    ["Delhi", "delivered", 4, 200, "c"], ["Delhi", "cancelled", 5, 200, "c"], ["Delhi", "delivered", 1, 10, "d"],
  ],
};
const inCity = (city: string): ContextFilter => ({ columns: new Set(["city"]), test: (r) => r[0] === city });
const m = (f: string, ...ctx: ContextFilter[]) => evaluateMeasure(ds, f, ctx);

describe("DAX measures", () => {
  it("aggregates the rows in the filter context", () => {
    expect(m("SUM([quantity])")).toBe(16);
    expect(m("SUM([quantity])", inCity("Pune"))).toBe(6);
    expect(m("COUNTROWS()", inCity("Delhi"))).toBe(3);
    expect(m("DISTINCTCOUNT([customer])")).toBe(4);
    expect(m("AVERAGE([price])", inCity("Pune"))).toBeCloseTo(83.333, 2);
  });

  it("CALCULATE replaces a filter on the same column and adds new ones", () => {
    expect(m('CALCULATE(SUM([quantity]), [status] = "delivered")', inCity("Pune"))).toBe(5);
    expect(m('CALCULATE(SUM([quantity]), [city] = "Delhi")', inCity("Pune"))).toBe(10); // the bar's own city is overridden
    expect(m('CALCULATE(COUNTROWS(), [status] = "delivered", [price] >= 100)')).toBe(2);
  });

  it("ALL removes the filters, which is how a share of the whole is written", () => {
    expect(m("DIVIDE(SUM([quantity]), CALCULATE(SUM([quantity]), ALL()))", inCity("Pune"))).toBeCloseTo(6 / 16, 6);
    expect(m("CALCULATE(SUM([quantity]), ALL([city]))", inCity("Pune"))).toBe(16);
  });

  it("DIVIDE returns blank, or the alternate, instead of failing on zero", () => {
    expect(m("DIVIDE(1, 0)")).toBeNull();
    expect(m("DIVIDE(1, 0, 0)")).toBe(0);
    expect(() => m("1 / 0")).toThrow(/divides by zero/);
  });

  it("iterators work out an expression per row: revenue is quantity times price, not a sum times a sum", () => {
    expect(m("SUMX(sales, [quantity] * [price])", inCity("Pune"))).toBe(2 * 100 + 1 * 100 + 3 * 50);
    expect(m("SUM([quantity]) * SUM([price])", inCity("Pune"))).not.toBe(m("SUMX(sales, [quantity] * [price])", inCity("Pune")));
  });

  it("supports arithmetic precedence, IF, ROUND and a table-qualified column", () => {
    expect(m("2 + 3 * 4")).toBe(14);
    expect(m("(2 + 3) * 4")).toBe(20);
    expect(m("-SUM(sales[quantity]) + 20")).toBe(4);
    expect(m('IF(SUM([quantity]) > 10, 1, 0)')).toBe(1);
    expect(m("ROUND(DIVIDE(10, 3), 2)")).toBe(3.33);
  });

  it("explains mistakes in words a learner can fix", () => {
    expect(() => m("SUM([nope])")).toThrow(/no column named \[nope\]/);
    expect(() => m("SUM([city])")).toThrow(/number column/);
    expect(() => m("[quantity]")).toThrow(/aggregation/);
    expect(() => m("SUM([quantity]")).toThrow(DaxError);
    expect(() => m("SUMM([quantity])")).toThrow(/not available/);
    expect(() => m('CALCULATE(SUM([quantity]), "x")')).toThrow(/must test a column/);
    expect(() => parseDax("")).toThrow(/Type a formula/);
    expect(() => parseDax("1 +")).toThrow(DaxError);
    expect(() => m('"text"')).toThrow(/number/);
  });

  it("refuses oversized or deeply nested input instead of hanging", () => {
    expect(() => parseDax("1+".repeat(300) + "1")).toThrow(/limited to/);
    expect(() => parseDax("(".repeat(40) + "1" + ")".repeat(40))).toThrow(/nested too deeply/);
  });

  it("is a closed interpreter: there is no way to reach host code from a formula", () => {
    expect(() => m("constructor")).toThrow(DaxError);
    expect(() => m("process.exit(1)")).toThrow(DaxError);
    expect(() => m("[__proto__]")).toThrow(DaxError);
  });
});
