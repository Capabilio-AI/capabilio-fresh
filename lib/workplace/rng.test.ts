import { describe, expect, it } from "vitest";
import { hashSeed, makeRng } from "./rng";

describe("seeded rng", () => {
  it("gives the same sequence for the same seed and a different one for another", () => {
    const a = makeRng(hashSeed("user-1", "world"));
    const b = makeRng(hashSeed("user-1", "world"));
    const c = makeRng(hashSeed("user-2", "world"));
    const seqA = Array.from({ length: 8 }, () => a.next());
    expect(Array.from({ length: 8 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 8 }, () => c.next())).not.toEqual(seqA);
  });

  it("keeps int within bounds and weighted picks only listed items", () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const n = r.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
    const seen = new Set(Array.from({ length: 200 }, () => r.weighted([["a", 3], ["b", 1]])));
    expect([...seen].sort()).toEqual(["a", "b"]);
  });

  it("shuffles without losing or duplicating items, and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = makeRng(3).shuffle(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
