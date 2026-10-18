import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/workplace/rng";
import { kindFor, missingByDifficulty, planDifficulties, subjectFor } from "./plan";

describe("missingByDifficulty", () => {
  it("counts only unsolved challenges against the mix", () => {
    const pool = [{ id: "a", difficulty: "easy" }, { id: "b", difficulty: "easy" }, { id: "c", difficulty: "medium" }];
    expect(missingByDifficulty(pool, new Set(["a"]), { easy: 3, medium: 1, hard: 2 })).toEqual({ easy: 2, medium: 0, hard: 2 });
  });
});

describe("planDifficulties", () => {
  it("writes the hardest first and caps the week", () => {
    expect(planDifficulties({ easy: 2, medium: 1, hard: 1 })).toEqual(["hard", "medium", "easy", "easy"]);
    expect(planDifficulties({ easy: 20, medium: 0, hard: 0 })).toHaveLength(9);
    expect(planDifficulties({ easy: 0, medium: 0, hard: 0 })).toEqual([]);
  });
});

describe("kindFor", () => {
  it("is mostly calculations with a concept question in every third slot", () => {
    expect([0, 1, 2, 3, 4, 5].map(kindFor)).toEqual(["numeric", "mcq", "numeric", "numeric", "mcq", "numeric"]);
  });
});

describe("subjectFor", () => {
  const courses = [{ title: "Thermodynamics", year: 2 }, { title: "Fluid Mechanics", year: 2 }, { title: "Engineering Drawing", year: 1 }, { title: "Heat Transfer", year: 3 }];
  it("takes the current year's course the student has had least from", () => {
    const usage = new Map([["thermodynamics", 3]]);
    expect(subjectFor(courses, 2, usage, makeRng(1))).toBe("Fluid Mechanics");
  });
  it("falls back to the adjacent years, then to all courses, then to null", () => {
    expect(["Engineering Drawing", "Heat Transfer"]).toContain(subjectFor(courses.filter((c) => c.year !== 2), 2, new Map(), makeRng(2)));
    expect(subjectFor(courses.filter((c) => c.year === 1), 4, new Map(), makeRng(3))).toBe("Engineering Drawing");
    expect(subjectFor([], 2, new Map(), makeRng(4))).toBeNull();
  });
});
