import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./calc-expression";

const v = (s: string) => {
  const r = evaluateExpression(s);
  return r.ok ? r.value : r.error;
};

describe("evaluateExpression", () => {
  it("respects precedence and parentheses", () => {
    expect(v("2 + 3 * 4")).toBe(14);
    expect(v("(2 + 3) * 4")).toBe(20);
    expect(v("10 / 4 - 1")).toBe(1.5);
  });
  it("handles powers right-associatively and unary minus", () => {
    expect(v("2 ^ 3 ^ 2")).toBe(512);
    expect(v("-2 ^ 2")).toBe(-4); // -(2^2), the usual mathematical reading
    expect(v("2 ^ -1")).toBe(0.5);
  });
  it("supports constants, functions and thousands separators", () => {
    expect(v("sqrt(16) + 1,000")).toBe(1004);
    expect(v("2 * pi")).toBeCloseTo(6.283185, 5);
    expect(v("log(1000)")).toBeCloseTo(3);
  });
  it("accepts scientific notation", () => expect(v("1.5e3 / 3")).toBe(500));
  it("reports problems instead of throwing or evaluating code", () => {
    expect(v("")).toBe("Type an expression.");
    expect(v("1 / 0")).toMatch(/finite/);
    expect(v("2 +")).toMatch(/ends early/);
    expect(v("(2")).toMatch(/Missing/);
    expect(v("alert(1)")).toMatch(/Unexpected/);
    expect(v("2 2")).toMatch(/Unexpected/);
  });
});
