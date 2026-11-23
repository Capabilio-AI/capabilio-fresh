import { describe, expect, it } from "vitest";
import { pickBySeed, proofMix } from "./tier-proof";

describe("tier proof set", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`);
  it("picks the same distinct problems for the same seed, different ones for another", () => {
    const a = pickBySeed(ids, "u1:1:easy:w1", 4);
    expect(a).toEqual(pickBySeed(ids, "u1:1:easy:w1", 4));
    expect(new Set(a).size).toBe(4);
    expect(pickBySeed(ids, "u1:1:easy:w2", 4)).not.toEqual(a);
  });
  it("returns fewer when the bank is short, so the caller can refuse instead of passing", () => {
    expect(pickBySeed(["a", "b"], "s", 4)).toHaveLength(2);
  });
  it("makes higher tiers harder and keeps four problems each", () => {
    for (const t of [1, 2, 3, 4] as const) expect(proofMix(t)).toHaveLength(4);
    expect(proofMix(1).every((d) => d === "easy")).toBe(true);
    expect(proofMix(4).filter((d) => d === "hard").length).toBeGreaterThan(proofMix(2).filter((d) => d === "hard").length);
  });
});
