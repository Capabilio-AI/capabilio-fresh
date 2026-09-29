import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { pickActiveRole, type DomainRoleRow } from "@/lib/arena-workstations/taxonomy";
import { switchActiveRole } from "./direction-writes";
import { ActiveRoleBodySchema } from "./schemas";
import { portfolioPromptDue } from "./track-signals";
import { isOpen } from "@/lib/launchpad/opportunities";

const role = (key: string): DomainRoleRow => ({ role_key: key, display_name: key, parent_skill_name: key, match_keywords: [key], enabled: true, created_at: "" });
const ROLES = [role("data-analyst"), role("ml-engineer")];

describe("pickActiveRole — explicit selection is config/data, not a code path per role", () => {
  it("an explicit active_role_key beats existing engagement and stated career", () => {
    expect(pickActiveRole(ROLES, { activeRoleKey: "ml-engineer", engagedRoleKey: "data-analyst", statedRole: "data-analyst" })?.role_key).toBe("ml-engineer");
  });
  it("without a selection the previous behavior is unchanged: engaged, then stated career, then first role", () => {
    expect(pickActiveRole(ROLES, { activeRoleKey: null, engagedRoleKey: "ml-engineer", statedRole: null })?.role_key).toBe("ml-engineer");
    expect(pickActiveRole(ROLES, { activeRoleKey: null, engagedRoleKey: null, statedRole: "ml-engineer" })?.role_key).toBe("ml-engineer");
    expect(pickActiveRole(ROLES, { activeRoleKey: null, engagedRoleKey: null, statedRole: null })?.role_key).toBe("data-analyst");
  });
  it("a stored key for a role that is no longer enabled is ignored", () => {
    expect(pickActiveRole([role("data-analyst")], { activeRoleKey: "gone", engagedRoleKey: null, statedRole: null })?.role_key).toBe("data-analyst");
  });
});

/** Records every table touched and every update, so we can prove the switch writes one row, two columns, nothing else. */
function recordingService(goalState: string | null) {
  const touched: string[] = [];
  const updates: { table: string; patch: Record<string, unknown> }[] = [];
  const row = {
    id: "m1", user_id: "u1", status: "active", branch: "CSE", created_at: "2026-01-01", start_year: 2024, end_year: 2028,
    year_confirmed_at: null, year_override: null, goal_state: goalState, goal_state_updated_at: null, goal_state_prompted_at: null,
    higher_studies_checkin_at: null, active_role_key: null, portfolio_prompt_seen_at: null, institutions: { academic_start_month: 7 },
  };
  const client = {
    from: (table: string) => {
      touched.push(table);
      const q = {
        select: () => q,
        eq: () => q,
        order: async () => ({ data: [row], error: null }),
        update: (patch: Record<string, unknown>) => ({ eq: () => ({ eq: async () => (updates.push({ table, patch }), { error: null }) }) }),
      };
      return q;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, touched, updates };
}

describe("Higher Studies switch preserves all prior Arena data", () => {
  it("writes exactly one field pair on the membership and touches no Arena/evidence/portfolio table", async () => {
    const { client, touched, updates } = recordingService("higher_studies");
    const res = await switchActiveRole(client, "u1", "ml-engineer", ["data-analyst", "ml-engineer"], new Date(2027, 0, 1));
    expect(res).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("institution_memberships");
    expect(Object.keys(updates[0].patch).sort()).toEqual(["active_role_key", "higher_studies_checkin_at"]);
    expect(new Set(touched)).toEqual(new Set(["institution_memberships"]));
  });
  it("rejects non-Higher-Studies students, unknown/disabled roles, and writes nothing", async () => {
    for (const [goal, key] of [["job", "ml-engineer"], [null, "ml-engineer"], ["higher_studies", "not-a-role"]] as const) {
      const { client, updates } = recordingService(goal);
      const res = await switchActiveRole(client, "u1", key, ["data-analyst", "ml-engineer"]);
      expect(res.ok).toBe(false);
      expect(updates).toHaveLength(0);
    }
  });
  it("body schema is strict — a client-supplied userId or goalState is rejected", () => {
    expect(ActiveRoleBodySchema.safeParse({ roleKey: "ml-engineer" }).success).toBe(true);
    expect(ActiveRoleBodySchema.safeParse({ roleKey: "ml-engineer", userId: "u2" }).success).toBe(false);
    expect(ActiveRoleBodySchema.safeParse({ roleKey: "ml-engineer", goalState: "higher_studies" }).success).toBe(false);
  });
});

describe("job track prompts come from real events only", () => {
  it("portfolio prompt fires only with a real new completion", () => {
    expect(portfolioPromptDue({ newVerifiedCompletions: 0, completedInterviewSessions: 5 })).toBe(false);
    expect(portfolioPromptDue({ newVerifiedCompletions: 1, completedInterviewSessions: 0 })).toBe(true);
  });
  it("Launchpad open-listing rule: no deadline or deadline today+ is open; past is not", () => {
    expect(isOpen(null, "2027-01-15")).toBe(true);
    expect(isOpen("2027-01-15", "2027-01-15")).toBe(true);
    expect(isOpen("2027-01-14", "2027-01-15")).toBe(false);
  });
});
