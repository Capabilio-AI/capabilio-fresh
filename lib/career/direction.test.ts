import { describe, expect, it } from "vitest";
import { buildDirection, needsYearConfirmation, shouldShowGoalPrompt, shouldShowHigherStudiesCheckin, trackFor } from "./direction";

const NOW = new Date(2027, 0, 15);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const row = (over: Record<string, unknown> = {}) =>
  buildDirection(
    {
      id: "m1", start_year: 2024, end_year: 2028, year_confirmed_at: daysAgo(1), year_override: null,
      goal_state: null, goal_state_updated_at: null, goal_state_prompted_at: null,
      higher_studies_checkin_at: null, active_role_key: null, portfolio_prompt_seen_at: null, ...over,
    },
    7,
    NOW
  );

describe("goal state → track", () => {
  it("maps unset and not_sure to job everywhere", () => {
    expect(trackFor(null)).toBe("job");
    expect(trackFor("not_sure")).toBe("job");
    expect(trackFor("higher_studies")).toBe("higher_studies");
    expect(trackFor("entrepreneur")).toBe("entrepreneur");
  });
  it("ignores an invalid stored value", () => expect(row({ goal_state: "hacker" }).goalState).toBeNull());
});

describe("goal prompt agrees with the trigger", () => {
  it("shows in the window when unset and never prompted", () => expect(shouldShowGoalPrompt(row())).toBe(true));
  it("does not show outside the window (end − year == 2)", () =>
    expect(shouldShowGoalPrompt(row({ end_year: 2029 }), NOW)).toBe(false));
  it("does not show once a real choice exists", () =>
    expect(shouldShowGoalPrompt(row({ goal_state: "job" }))).toBe(false));
  it("resurfaces not_sure only after 14 days", () => {
    expect(shouldShowGoalPrompt(row({ goal_state: "not_sure", goal_state_prompted_at: daysAgo(13) }), NOW)).toBe(false);
    expect(shouldShowGoalPrompt(row({ goal_state: "not_sure", goal_state_prompted_at: daysAgo(14) }), NOW)).toBe(true);
  });
});

describe("higher studies check-in", () => {
  it("fires at 90 days from the last answer or change", () => {
    const base = { goal_state: "higher_studies", goal_state_updated_at: daysAgo(200) };
    expect(shouldShowHigherStudiesCheckin(row({ ...base, higher_studies_checkin_at: daysAgo(89) }), NOW)).toBe(false);
    expect(shouldShowHigherStudiesCheckin(row({ ...base, higher_studies_checkin_at: daysAgo(90) }), NOW)).toBe(true);
  });
  it("never fires for other goal states", () =>
    expect(shouldShowHigherStudiesCheckin(row({ goal_state: "job", goal_state_updated_at: daysAgo(400) }), NOW)).toBe(false));
});

describe("year confirmation", () => {
  it("required when never confirmed, when years are missing, and after 180 days", () => {
    expect(needsYearConfirmation(row({ year_confirmed_at: null }), NOW)).toBe(true);
    expect(needsYearConfirmation(row({ start_year: null }), NOW)).toBe(true);
    expect(needsYearConfirmation(row({ year_confirmed_at: daysAgo(181) }), NOW)).toBe(true);
    expect(needsYearConfirmation(row({ year_confirmed_at: daysAgo(10) }), NOW)).toBe(false);
  });
});
