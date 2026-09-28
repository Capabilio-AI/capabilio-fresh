import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { requireUser } from "./require-user";

function supabaseWithUser(user: { id: string } | null): SupabaseClient<Database> {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
  } as unknown as SupabaseClient<Database>;
}

// requireUser is the shared auth gate every Code DNA route (and every other
// session-scoped route) calls first — testing it once covers "an
// unauthenticated request is rejected" for all of them.
describe("requireUser", () => {
  it("rejects with 401 when there is no session user", async () => {
    const result = await requireUser(supabaseWithUser(null));
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(401);
    }
  });

  it("returns the real session user id when authenticated, never a client-suppliable value", async () => {
    const result = await requireUser(supabaseWithUser({ id: "real-session-user-id" }));
    expect("userId" in result).toBe(true);
    if ("userId" in result) {
      expect(result.userId).toBe("real-session-user-id");
    }
  });
});
