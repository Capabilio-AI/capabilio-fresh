import { describe, expect, it } from "vitest";
import { exhaustedMessage, freshOnly } from "./never-repeat";

const q = (id: string) => ({ id });

describe("freshOnly", () => {
  it("drops every question the student has already been given", () => {
    expect(freshOnly([q("a"), q("b"), q("c")], new Set(["b"])).map((x) => x.id)).toEqual(["a", "c"]);
  });
  it("keeps everything for a student who has seen nothing, and never mutates the pool", () => {
    const pool = [q("a"), q("b")];
    expect(freshOnly(pool, new Set())).toEqual(pool);
    expect(freshOnly(pool, new Set(["a", "b"]))).toEqual([]);
    expect(pool).toHaveLength(2);
  });
});

describe("exhaustedMessage", () => {
  it("says honestly what is left and what the test needs, and that more are coming", () => {
    const m = exhaustedMessage("Quantitative aptitude", 10, 3);
    expect(m).toContain("Quantitative aptitude");
    expect(m).toContain("3");
    expect(m).toContain("10");
    expect(m).toMatch(/new questions/i);
  });
  it("is plainer when nothing is left", () => {
    expect(exhaustedMessage("Verbal ability", 8, 0)).toMatch(/every/i);
  });
});
