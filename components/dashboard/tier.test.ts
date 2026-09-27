import { describe, expect, it } from "vitest";
import { scoreTier, TIER_LABEL } from "./tier";

describe("scoreTier", () => {
  it("classifies 80 and above as high", () => {
    expect(scoreTier(80)).toBe("high");
    expect(scoreTier(100)).toBe("high");
  });

  it("classifies 50-79 as mid", () => {
    expect(scoreTier(50)).toBe("mid");
    expect(scoreTier(79)).toBe("mid");
  });

  it("classifies below 50 as low, never as an error state", () => {
    expect(scoreTier(0)).toBe("low");
    expect(scoreTier(49)).toBe("low");
    // Low is a development signal, not a failure — see components/dashboard/tier.ts.
    expect(TIER_LABEL.low).toBe("Needs development");
  });
});
