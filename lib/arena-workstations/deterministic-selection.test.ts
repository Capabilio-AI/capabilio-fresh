import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getEngagedRoleKey, listEnabledRoles } from "./taxonomy";

/** Records every builder call so we can assert the query is ordered, and returns rows in the order a real DB would after ORDER BY. */
function recording(rows: Record<string, unknown>[]) {
  const calls: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "limit"]) q[m] = (...a: unknown[]) => (calls.push([m, a]), q);
  q.order = (...a: unknown[]) => (calls.push(["order", a]), q);
  q.then = (r: (v: unknown) => void) => r({ data: rows, error: null });
  return { client: { from: () => q } as unknown as SupabaseClient<Database>, calls };
}

describe("row selection is deterministic", () => {
  it("engaged role: most recently advanced rotation wins, ties broken by role_key", async () => {
    const { client, calls } = recording([{ role_key: "ml-engineer" }]);
    expect(await getEngagedRoleKey(client, "u")).toBe("ml-engineer");
    const orders = calls.filter(([m]) => m === "order").map(([, a]) => a);
    expect(orders[0]).toEqual(["updated_at", { ascending: false }]);
    expect(orders[1]).toEqual(["role_key"]);
  });
  it("engaged role: null when there are no rotation rows", async () => {
    expect(await getEngagedRoleKey(recording([]).client, "u")).toBeNull();
  });
  it("role list is ordered, so roles[0] fallbacks and first-keyword-match are stable", async () => {
    const { client, calls } = recording([]);
    await listEnabledRoles(client);
    expect(calls.filter(([m]) => m === "order").map(([, a]) => a[0])).toEqual(["created_at", "role_key"]);
  });
});
