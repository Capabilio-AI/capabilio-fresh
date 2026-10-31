import { describe, expect, it } from "vitest";
import { cleanStartsAt } from "./circular";

describe("cleanStartsAt", () => {
  it("keeps a valid local date-time", () => expect(cleanStartsAt("2026-02-28T09:00")).toBe("2026-02-28T09:00"));
  it("drops anything the date-time input cannot show", () => {
    expect(cleanStartsAt("28.02.2026")).toBeNull();
    expect(cleanStartsAt("2026-02-30T99:00")).toBeNull();
    expect(cleanStartsAt(null)).toBeNull();
  });
});
