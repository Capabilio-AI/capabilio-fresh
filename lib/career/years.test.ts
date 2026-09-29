import { describe, expect, it } from "vitest";
import { validateProgramYears } from "./years";

const NOW = new Date(2026, 8, 1);
describe("validateProgramYears", () => {
  it("accepts a normal B.Tech span, from strings or numbers", () => {
    expect(validateProgramYears("2024", "2028", NOW)).toEqual({ ok: true, startYear: 2024, endYear: 2028 });
    expect(validateProgramYears(2026, 2030, NOW).ok).toBe(true);
  });
  it.each([
    ["", "2028"], ["2024", "abc"], ["2028", "2024"], ["2024", "2024"], ["2024", "2033"], ["1999", "2003"], ["2030", "2034"], [2024.5, 2028],
  ])("rejects %s → %s", (s, e) => expect(validateProgramYears(s, e, NOW).ok).toBe(false));
});
