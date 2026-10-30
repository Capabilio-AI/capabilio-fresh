import { describe, expect, it } from "vitest";
import { endOfDayIst, istDate } from "./format";

describe("istDate", () => {
  it("rolls to the next day after 18:30 UTC", () => {
    expect(istDate(new Date("2026-03-01T18:29:00Z"))).toBe("2026-03-01");
    expect(istDate(new Date("2026-03-01T18:31:00Z"))).toBe("2026-03-02");
  });
});

describe("endOfDayIst", () => {
  it("is 23:59 in India, not 23:59 UTC", () => {
    expect(endOfDayIst("2026-03-01")).toBe("2026-03-01T18:29:00.000Z");
  });
});
