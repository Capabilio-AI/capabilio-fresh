import { describe, expect, it } from "vitest";
import { gradeSqlResult } from "./grade";

const expected = { columns: ["category", "revenue"], rows: [["Electronics", 1234.56], ["Beauty", 99.5]], truncated: false };

describe("gradeSqlResult", () => {
  it("passes with the same values under different column names, order and case", () => {
    const actual = { columns: ["rev", "cat"], rows: [[99.5, "beauty"], [1234.555, "ELECTRONICS "]], truncated: false };
    expect(gradeSqlResult(expected, actual).passed).toBe(true);
  });

  it("fails when the row count differs (e.g. SELECT * dumps)", () => {
    const actual = { columns: ["category", "revenue"], rows: [["Electronics", 1234.56], ["Beauty", 99.5], ["Grocery", 1]], truncated: false };
    const res = gradeSqlResult(expected, actual);
    expect(res.passed).toBe(false);
    expect(res.message).toContain("Expected 2 rows");
  });

  it("fails when a value is off by more than rounding", () => {
    const actual = { columns: ["category", "revenue"], rows: [["Electronics", 1403.56], ["Beauty", 99.5]], truncated: false };
    const res = gradeSqlResult(expected, actual);
    expect(res.passed).toBe(false);
    expect(res.matchedValues).toBe(3);
  });

  it("does not let one student value satisfy two expected values", () => {
    const twice = { columns: ["a", "b"], rows: [[10, 10]], truncated: false };
    const once = { columns: ["a", "b"], rows: [[10, 7]], truncated: false };
    expect(gradeSqlResult(twice, once).passed).toBe(false);
  });

  it("reports the student's SQL error without revealing expected values", () => {
    const res = gradeSqlResult(expected, { error: "no such column: revnue" });
    expect(res.passed).toBe(false);
    expect(res.message).toContain("no such column");
    expect(res.message).not.toContain("1234");
  });

  it("throws on a broken ground-truth query (content bug, not the student's fault)", () => {
    expect(() => gradeSqlResult({ error: "syntax error" }, expected)).toThrow(/content bug/);
  });
});
