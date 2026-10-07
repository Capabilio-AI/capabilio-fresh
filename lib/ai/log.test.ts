import { describe, expect, it } from "vitest";
import { estimateCostCents } from "./log";

describe("estimateCostCents", () => {
  const usage = { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 };
  it("prices tokens at the configured per-million rates", () => {
    expect(estimateCostCents(usage, { inputPerMtok: 15, outputPerMtok: 60 })).toBeCloseTo((1000 * 15 + 500 * 60) / 1e6, 10);
  });
  it("is unknown (null), not zero, when usage or a rate is missing", () => {
    expect(estimateCostCents(undefined, { inputPerMtok: 15, outputPerMtok: 60 })).toBeNull();
    expect(estimateCostCents({ promptTokens: null, completionTokens: null, totalTokens: null }, { inputPerMtok: 15, outputPerMtok: 60 })).toBeNull();
    expect(estimateCostCents(usage, { inputPerMtok: null, outputPerMtok: 60 })).toBeNull();
    expect(estimateCostCents(usage, { inputPerMtok: 15, outputPerMtok: null })).toBeNull();
  });
});
