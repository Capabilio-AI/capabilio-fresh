import { describe, expect, it } from "vitest";
import { JUDGE_LANGUAGES, starterFor } from "./starters";
import type { PublicProblem } from "./problem";

const problem: PublicProblem = {
  statement: "s", inputFormat: "One integer n.", outputFormat: "One integer.", constraints: [], examples: [],
  starters: { python: "PY", c: "C" },
};

describe("starterFor", () => {
  it("gives every offered language a starter, and the other languages carry the problem's formats", () => {
    for (const l of JUDGE_LANGUAGES) {
      const code = starterFor(problem, l.id);
      expect(code.length).toBeGreaterThan(0);
      if (l.id !== "python" && l.id !== "c") expect(code).toContain("One integer n.");
    }
  });
  it("keeps the problem's own Python and C skeletons", () => {
    expect(starterFor(problem, "python")).toBe("PY");
    expect(starterFor(problem, "c")).toBe("C");
  });
});
