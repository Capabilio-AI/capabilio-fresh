import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentBranchContext } from "./attempts";

interface FakeRow {
  branch: string | null;
  year: string | null;
  status: string;
  institutions: { college_type: string | null } | null;
}

function supabaseReturning(rows: FakeRow[]): SupabaseClient<Database> {
  const query = {
    select: () => query,
    eq: () => query,
    order: async () => ({ data: rows, error: null }),
  };
  return { from: () => query } as unknown as SupabaseClient<Database>;
}

describe("getStudentBranchContext", () => {
  it("returns the branch when there's exactly one membership row", () => {
    const supabase = supabaseReturning([{ branch: "Mechanical Engineering", year: "3", status: "active", institutions: { college_type: "engineering" } }]);
    return getStudentBranchContext(supabase, "u1").then((ctx) => {
      expect(ctx.branch).toBe("Mechanical Engineering");
    });
  });

  it("picks the active row with a real branch over other stray rows -- the confirmed live bug: a student had one active branch and two other null-branch rows, and .maybeSingle() silently resolved to no branch at all", async () => {
    const supabase = supabaseReturning([
      { branch: null, year: null, status: "pending", institutions: null },
      { branch: "Mechanical Engineering", year: "3", status: "active", institutions: { college_type: "engineering" } },
      { branch: null, year: null, status: "revoked", institutions: null },
    ]);
    const ctx = await getStudentBranchContext(supabase, "u1");
    expect(ctx.branch).toBe("Mechanical Engineering");
  });

  it("falls back to any row with a branch set if none is active", async () => {
    const supabase = supabaseReturning([
      { branch: null, year: null, status: "pending", institutions: null },
      { branch: "Civil Engineering", year: "2", status: "revoked", institutions: { college_type: "engineering" } },
    ]);
    const ctx = await getStudentBranchContext(supabase, "u1");
    expect(ctx.branch).toBe("Civil Engineering");
  });

  it("returns null branch (never throws) when there are no membership rows at all", async () => {
    const supabase = supabaseReturning([]);
    const ctx = await getStudentBranchContext(supabase, "u1");
    expect(ctx.branch).toBeNull();
  });
});
