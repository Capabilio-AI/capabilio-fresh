import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { recordPromptSeen, saveGoalState, saveProgramYears } from "./direction-writes";
import { DismissBodySchema, GoalStateBodySchema, YearBodySchema } from "./schemas";
import { getStudentDirection, trackFor } from "./direction";

type Row = Record<string, unknown>;
const MEMBERSHIP = (over: Row = {}): Row => ({
  id: "m-own", user_id: "u-own", status: "active", branch: "CSE", created_at: "2026-01-01",
  start_year: 2024, end_year: 2028, year_confirmed_at: null, year_override: null, goal_state: null,
  goal_state_updated_at: null, goal_state_prompted_at: null, higher_studies_checkin_at: null,
  active_role_key: null, portfolio_prompt_seen_at: null, institutions: { academic_start_month: 7 }, ...over,
});

/** In-memory fake: rows filtered by the same user_id the code passes, updates recorded per row id. */
function fakeService(rows: Row[]) {
  const updates: { id: unknown; userId: unknown; patch: Row }[] = [];
  const client = {
    from: () => {
      const filters: Row = {};
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => ((filters[k] = v), q),
        order: async () => ({ data: rows.filter((r) => r.user_id === filters.user_id), error: null }),
        update: (patch: Row) => ({
          eq: (_k: string, id: unknown) => ({
            eq: async (_k2: string, userId: unknown) => {
              updates.push({ id, userId, patch });
              return { error: null };
            },
          }),
        }),
      };
      return q;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, updates };
}

const NOW = new Date(2027, 0, 15);

describe("goal state writes", () => {
  it.each(["job", "higher_studies", "entrepreneur", "not_sure"] as const)("persists a transition to %s and restarts the clocks", async (state) => {
    const { client, updates } = fakeService([MEMBERSHIP()]);
    expect(await saveGoalState(client, "u-own", state, NOW)).toEqual({ ok: true });
    expect(updates[0].patch).toMatchObject({ goal_state: state, goal_state_updated_at: NOW.toISOString(), goal_state_prompted_at: NOW.toISOString() });
    expect(updates[0].patch.higher_studies_checkin_at).toBe(state === "higher_studies" ? NOW.toISOString() : null);
  });

  it("an update is always scoped to the caller's own membership id and user id (authorization)", async () => {
    const { client, updates } = fakeService([MEMBERSHIP(), MEMBERSHIP({ id: "m-other", user_id: "u-other" })]);
    await saveGoalState(client, "u-own", "job", NOW);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: "m-own", userId: "u-own" });
  });

  it("a user with no membership gets 404, never someone else's row", async () => {
    const { client, updates } = fakeService([MEMBERSHIP({ user_id: "u-other" })]);
    expect(await saveGoalState(client, "u-own", "job", NOW)).toMatchObject({ ok: false, status: 404 });
    expect(updates).toHaveLength(0);
  });

  it("reads are live: the direction reflects the newest stored state on every call, and unset/not_sure behave as job", async () => {
    const rows = [MEMBERSHIP({ goal_state: "not_sure" })];
    const { client } = fakeService(rows);
    expect((await getStudentDirection(client, "u-own", NOW))?.track).toBe("job");
    rows[0].goal_state = "entrepreneur";
    expect((await getStudentDirection(client, "u-own", NOW))?.track).toBe("entrepreneur");
    expect(trackFor(null)).toBe("job");
  });

  it("dismiss only restarts the relevant clock and never changes goal_state", async () => {
    const { client, updates } = fakeService([MEMBERSHIP()]);
    await recordPromptSeen(client, "u-own", "goal", NOW);
    await recordPromptSeen(client, "u-own", "checkin", NOW);
    expect(Object.keys(updates[0].patch)).toEqual(["goal_state_prompted_at"]);
    expect(Object.keys(updates[1].patch)).toEqual(["higher_studies_checkin_at"]);
  });
});

describe("program years writes", () => {
  it("validates before writing and stamps confirmation", async () => {
    const { client, updates } = fakeService([MEMBERSHIP()]);
    expect(await saveProgramYears(client, "u-own", { startYear: 2028, endYear: 2024, currentYearOverride: null }, NOW)).toMatchObject({ ok: false, status: 400 });
    expect(updates).toHaveLength(0);
    await saveProgramYears(client, "u-own", { startYear: 2024, endYear: 2028, currentYearOverride: 5 }, NOW);
    expect(updates[0].patch).toMatchObject({ start_year: 2024, end_year: 2028, year_override: 5, year_confirmed_at: NOW.toISOString() });
  });
});

describe("server authority: client-supplied trusted values are rejected, not ignored-and-applied", () => {
  it("goal-state body rejects extra keys and invalid states", () => {
    expect(GoalStateBodySchema.safeParse({ goalState: "job" }).success).toBe(true);
    for (const bad of [
      { goalState: "job", userId: "someone-else" },
      { goalState: "job", membershipId: "m-other" },
      { goalState: "job", assessmentMode: "light" },
      { goalState: "job", inDirectionWindow: true },
      { goalState: "admin" },
      {},
    ]) expect(GoalStateBodySchema.safeParse(bad).success).toBe(false);
  });
  it("year and dismiss bodies are strict too", () => {
    expect(YearBodySchema.safeParse({ startYear: 2024, endYear: 2028, currentYearOverride: null, goal_state: "job" }).success).toBe(false);
    expect(DismissBodySchema.safeParse({ prompt: "goal", goalState: "job" }).success).toBe(false);
    expect(DismissBodySchema.safeParse({ prompt: "checkin" }).success).toBe(true);
  });
});
