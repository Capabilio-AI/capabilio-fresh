import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listEnabledRoles } from "./taxonomy";

const rows = ["data-analyst", "test-walkthrough"].map((k) => ({ role_key: k, display_name: k, parent_skill_name: k, match_keywords: [], enabled: true, created_at: "" }));
const service = {
  from: () => {
    const q: Record<string, unknown> = { select: () => q, eq: () => q, order: () => q, then: (r: (v: unknown) => void) => r({ data: rows, error: null }) };
    return q;
  },
} as unknown as SupabaseClient<Database>;

describe("test- roles are never served in production", () => {
  afterEach(() => delete process.env.ALLOW_TEST_ROLES);
  it("are filtered out even when enabled in the database", async () => {
    expect((await listEnabledRoles(service)).map((r) => r.role_key)).toEqual(["data-analyst"]);
  });
  it("appear only when a local test run opts in", async () => {
    process.env.ALLOW_TEST_ROLES = "1";
    expect((await listEnabledRoles(service)).map((r) => r.role_key)).toEqual(["data-analyst", "test-walkthrough"]);
  });
});
