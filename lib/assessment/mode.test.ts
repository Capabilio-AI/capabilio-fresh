import { describe, expect, it } from "vitest";
import { assessmentModeFor, LIGHT_SECTIONS, sectionsForMode } from "./mode";
import { buildDirection } from "@/lib/career/direction";

const NOW = new Date(2027, 0, 15);
const dir = (endYear: number | null) =>
  buildDirection(
    { id: "m", start_year: 2024, end_year: endYear, year_confirmed_at: null, year_override: null, goal_state: null,
      goal_state_updated_at: null, goal_state_prompted_at: null, higher_studies_checkin_at: null, active_role_key: null, portfolio_prompt_seen_at: null },
    7,
    NOW
  );

describe("assessment mode is decided by the shared trigger", () => {
  it("light exactly at end_year − year == 1; full at == 2; full with no membership", () => {
    expect(assessmentModeFor(dir(2028))).toBe("light");
    expect(assessmentModeFor(dir(2029))).toBe("full");
    expect(assessmentModeFor(null)).toBe("full");
  });
  it("light = Communication + Career Interest only", () => {
    expect(sectionsForMode("light")).toEqual(LIGHT_SECTIONS);
    expect(sectionsForMode("full")).toHaveLength(7);
  });
});
