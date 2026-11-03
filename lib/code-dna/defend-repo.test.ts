import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/groq", () => ({ completeJson: vi.fn() }));
import { briefText, cleanAnswers, hasSubstance, QUESTION_COUNT } from "./defend-repo";

describe("cleanAnswers", () => {
  it("needs exactly one string answer per question and trims them", () => {
    const ok = Array.from({ length: QUESTION_COUNT }, () => "  an answer  ");
    expect(cleanAnswers(ok)).toEqual(Array.from({ length: QUESTION_COUNT }, () => "an answer"));
    expect(cleanAnswers(ok.slice(1))).toBeNull();
    expect(cleanAnswers("nope")).toBeNull();
    expect(cleanAnswers([...ok.slice(1), 5])).toBeNull();
  });

  it("caps very long answers", () => {
    const long = Array.from({ length: QUESTION_COUNT }, () => "x".repeat(5000));
    expect(cleanAnswers(long)?.[0].length).toBe(1200);
  });
});

describe("hasSubstance", () => {
  it("rejects near-empty explanations", () => {
    expect(hasSubstance(["idk", "", "no", "skip"])).toBe(false);
    expect(hasSubstance(["I used a reducer to keep cart totals in one place so every screen agrees", "It retries twice then shows the error", "I tested the total with empty and large carts", "I would add caching"])).toBe(true);
  });
});

describe("briefText", () => {
  it("includes the repository, readme and each file", () => {
    const text = briefText({ fullName: "u/shop", description: "A shop", language: "TypeScript", readme: "Hello", files: [{ path: "src/cart.ts", excerpt: "export const x = 1" }] });
    expect(text).toContain("u/shop (TypeScript)");
    expect(text).toContain("--- src/cart.ts ---");
  });
});
