import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";

// A real signed-in client with the public key is exactly what an attacker with devtools has.
// These must stay blocked: the server (service role, via API routes) is the only writer of
// membership/goal/role/curriculum data. See docs/job-track-audit.md (Part A).
const service = liveServiceClient();
let user: { userId: string; email: string; password: string };
let client: SupabaseClient<Database>;
let institutionId: string;
let membershipId: string;

describe("clients cannot write privileged rows directly", () => {
  beforeAll(async () => {
    user = await createThrowawayUserWithLogin(service, "rls");
    client = await signedInClient(user.email, user.password);
    const { data: inst } = await service.from("institutions").insert({ name: `ZZ RLS TEST ${Date.now()}`, slug: `zz-rls-${Date.now()}` }).select("id").single();
    institutionId = inst!.id;
    const { data: m } = await service
      .from("institution_memberships")
      .insert({ user_id: user.userId, institution_id: institutionId, role: "student", status: "active", branch: "ZZ", start_year: 2024, end_year: 2028 })
      .select("id")
      .single();
    membershipId = m!.id;
  });

  afterAll(async () => {
    await service.from("institution_memberships").delete().eq("user_id", user.userId);
    await service.from("institutions").delete().eq("id", institutionId);
    await deleteThrowawayUser(service, user.userId);
  });

  it("a client cannot INSERT a membership (role, goal_state, active_role_key…)", async () => {
    const { data: other } = await service.from("institutions").insert({ name: `ZZ RLS TEST B ${Date.now()}`, slug: `zz-rls-b-${Date.now()}` }).select("id").single();
    const res = await client
      .from("institution_memberships")
      .insert({ user_id: user.userId, institution_id: other!.id, role: "principal", status: "active", goal_state: "job", active_role_key: "data-analyst" })
      .select("id");
    await service.from("institutions").delete().eq("id", other!.id);
    expect(res.error).not.toBeNull();
    expect(res.data ?? []).toHaveLength(0);
  });

  it("a client cannot UPDATE its own membership", async () => {
    const res = await client.from("institution_memberships").update({ goal_state: "entrepreneur", role: "principal", active_role_key: "x" }).eq("id", membershipId).select("id");
    expect(res.error).not.toBeNull();
    const { data } = await service.from("institution_memberships").select("goal_state, role, active_role_key").eq("id", membershipId).single();
    expect(data).toEqual({ goal_state: null, role: "student", active_role_key: null });
  });

  it("a client cannot change profiles.primary_role, but can still edit its display fields", async () => {
    const blocked = await client.from("profiles").update({ primary_role: "principal" }).eq("id", user.userId).select("primary_role");
    expect(blocked.error).not.toBeNull();
    const ok = await client.from("profiles").update({ full_name: "ZZ Renamed" }).eq("id", user.userId).select("full_name");
    expect(ok.error).toBeNull();
    expect(ok.data?.[0]?.full_name).toBe("ZZ Renamed");
  });
});
