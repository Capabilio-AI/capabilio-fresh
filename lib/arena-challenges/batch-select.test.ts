import { describe, expect, it } from "vitest";
import { pickWeeklyBatch } from "./batch-select";

function pool(ids: string[]) {
  return ids.map((id) => ({ id }));
}

describe("pickWeeklyBatch", () => {
  it("picks exactly taskCount challenges when the pool is large enough", () => {
    const result = pickWeeklyBatch(pool(["a", "b", "c", "d", "e", "f"]), 5, []);
    expect(result).toHaveLength(5);
    expect(new Set(result).size).toBe(5);
  });

  it("prefers challenges not used in the previous week", () => {
    const result = pickWeeklyBatch(pool(["a", "b", "c", "d"]), 2, ["a", "b"]);
    expect(result).toEqual(["c", "d"]);
  });

  it("falls back to reusing recent challenges once the fresh pool is too small, rather than under-delivering", () => {
    const result = pickWeeklyBatch(pool(["a", "b"]), 2, ["a"]);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("never returns more than the pool actually has", () => {
    const result = pickWeeklyBatch(pool(["a", "b"]), 5, []);
    expect(result).toHaveLength(2);
  });

  it("never returns duplicate ids", () => {
    const result = pickWeeklyBatch(pool(["a", "b", "c"]), 3, []);
    expect(new Set(result).size).toBe(result.length);
  });
});
