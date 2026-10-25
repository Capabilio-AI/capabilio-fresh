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
  it("only required when years are missing, never re-asked once saved at signup", () => {
    expect(needsYearConfirmation(row({ year_confirmed_at: null }), NOW)).toBe(false);
    expect(needsYearConfirmation(row({ start_year: null }), NOW)).toBe(true);
    expect(needsYearConfirmation(row({ year_confirmed_at: daysAgo(181) }), NOW)).toBe(false);
    expect(needsYearConfirmation(row({ year_confirmed_at: daysAgo(10) }), NOW)).toBe(false);
  });
});

describe("term gates (Launchpad 4-1, Plan B from 3-1)", () => {
  const at = (now: Date, over: Record<string, unknown> = {}) =>
    buildDirection(
      { id: "m1", start_year: 2024, end_year: 2028, year_confirmed_at: now.toISOString(), year_override: null, goal_state: null, goal_state_updated_at: null, goal_state_prompted_at: null, higher_studies_checkin_at: null, active_role_key: null, portfolio_prompt_seen_at: null, ...over },
      7,
      now
    );
  it("opens Plan B from 3-1 on, not before", () => {
    expect(at(new Date(2026, 7, 1)).planBOpen).toBe(true); // Aug 2026: 3rd year, semester 1
    expect(at(new Date(2027, 0, 15)).planBOpen).toBe(true); // 3-2
    expect(at(new Date(2027, 7, 1)).planBOpen).toBe(true); // 4-1
    expect(at(new Date(2025, 7, 1)).planBOpen).toBe(false); // 2-1
    expect(at(new Date(2026, 0, 15)).planBOpen).toBe(false); // 2-2
  });
  it("opens Launchpad from 4-1 on, not before", () => {
    expect(at(new Date(2027, 0, 15)).launchpadOpen).toBe(false); // 3-2
    expect(at(new Date(2027, 7, 1)).launchpadOpen).toBe(true); // 4-1
    expect(at(new Date(2028, 0, 15)).launchpadOpen).toBe(true); // 4-2
  });
  it("a student-confirmed semester wins over the calendar estimate", () => {
    expect(at(new Date(2026, 0, 15), { current_semester: 1 }).launchpadOpen).toBe(false);
    expect(at(new Date(2025, 7, 1), { current_semester: 2 }).planBOpen).toBe(false); // still 2nd year
  });
});

describe("the college's semester-1 date opens Plan B (3-1) and Launchpad with the AI Interview (4-1)", () => {
  // started 2024, ends 2028, academic year begins in July: July 2026 - June 2027 is the 3rd year, July 2027 - June 2028 the 4th
  const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));
  const dir = (now: Date, firstStart: string | null) =>
    buildDirection({ id: "m", start_year: 2024, end_year: 2028, year_confirmed_at: null, year_override: null, goal_state: null, goal_state_updated_at: null, goal_state_prompted_at: null, higher_studies_checkin_at: null, active_role_key: null, portfolio_prompt_seen_at: null }, 7, now, null, firstStart);

  it("Plan B waits for the college's 3-1 date when it is set, then opens on it", () => {
    expect(dir(at(2026, 8, 10), "2026-09-01")).toMatchObject({ planBOpen: false, launchpadOpen: false });
    expect(dir(at(2026, 9, 1), "2026-09-01").planBOpen).toBe(true);
    expect(dir(at(2026, 9, 2), "2026-09-01").planBOpen).toBe(true);
  });
  it("with no date the third year opens Plan B as it always did", () => {
    expect(dir(at(2026, 8, 10), null).planBOpen).toBe(true);
  });
  it("Launchpad and the AI Interview wait for 4-1, never opening in the third year", () => {
    expect(dir(at(2026, 9, 5), "2026-09-01").launchpadOpen).toBe(false);
    expect(dir(at(2027, 8, 10), "2027-09-01")).toMatchObject({ launchpadOpen: false, planBOpen: true });
    expect(dir(at(2027, 9, 1), "2027-09-01").launchpadOpen).toBe(true);
    expect(dir(at(2027, 8, 10), null).launchpadOpen).toBe(true);
  });
  it("a student already in the second semester is not held back by a first-semester date", () => {
    expect(dir(at(2027, 2, 10), "2027-09-01").planBOpen).toBe(true);
  });
});
