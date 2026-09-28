import { describe, expect, it } from "vitest";
import { isNumericAnswerCorrect, parseNumericAnswer } from "./numeric-answer";

describe("parseNumericAnswer", () => {
  it("reads plain, comma-grouped, unit-suffixed and exponent answers", () => {
    expect(parseNumericAnswer("12.5")).toBe(12.5);
    expect(parseNumericAnswer("1,250")).toBe(1250);
    expect(parseNumericAnswer("12.5 kN")).toBe(12.5);
    expect(parseNumericAnswer("1.2e3")).toBe(1200);
    expect(parseNumericAnswer("-0.5")).toBe(-0.5);
  });

  it("returns null when there is no leading number", () => {
    expect(parseNumericAnswer("")).toBeNull();
    expect(parseNumericAnswer("about 12")).toBeNull();
  });
});

describe("isNumericAnswerCorrect", () => {
  it("accepts answers within 1% of the expected value", () => {
    expect(isNumericAnswerCorrect("100.9", "100")).toBe(true);
    expect(isNumericAnswerCorrect("99.1", "100")).toBe(true);
  });

  it("rejects answers outside 1%", () => {
    expect(isNumericAnswerCorrect("101.5", "100")).toBe(false);
    expect(isNumericAnswerCorrect("abc", "100")).toBe(false);
  });

  it("handles an expected value of zero", () => {
    expect(isNumericAnswerCorrect("0", "0")).toBe(true);
    expect(isNumericAnswerCorrect("0.01", "0")).toBe(false);
  });
});
