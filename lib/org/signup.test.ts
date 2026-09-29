import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OrgSignupSchema, registerOrganisation, roleFor } from "./signup";

const base = { orgName: "ZZ College", fullName: "Asha Rao", email: "a@b.co", password: "longenough1" };

describe("OrgSignupSchema", () => {
  it("accepts institution with designation and company without", () => {
    expect(OrgSignupSchema.safeParse({ ...base, orgType: "institution", designation: "tpo" }).success).toBe(true);
    expect(OrgSignupSchema.safeParse({ ...base, orgType: "company" }).success).toBe(true);
  });
  it("rejects client-supplied role/status/userId, privileged designations, and bad shapes", () => {
    const inst = { ...base, orgType: "institution", designation: "tpo" };
    for (const extra of [{ role: "principal" }, { status: "active" }, { userId: "x" }, { primary_role: "ceo" }]) {
      expect(OrgSignupSchema.safeParse({ ...inst, ...extra }).success).toBe(false);
    }
    expect(OrgSignupSchema.safeParse({ ...inst, designation: "ceo" }).success).toBe(false);
    expect(OrgSignupSchema.safeParse({ ...base, orgType: "institution" }).success).toBe(false);
    expect(OrgSignupSchema.safeParse({ ...base, orgType: "company", designation: "principal" }).success).toBe(false);
    expect(OrgSignupSchema.safeParse({ ...inst, password: "short" }).success).toBe(false);
  });
  it("maps type to a fixed role server-side", () => {
    expect(roleFor({ orgType: "company" })).toBe("company_admin");
    expect(roleFor({ orgType: "institution", designation: "hod" })).toBe("hod");
  });
});

describe("registerOrganisation", () => {
  const input = OrgSignupSchema.parse({ ...base, orgType: "institution", designation: "tpo" });
  const mk = (signUp: unknown, rpc = vi.fn().mockResolvedValue({ error: null })) => {
    const deleteUser = vi.fn().mockResolvedValue({});
    return {
      auth: { auth: { signUp } } as unknown as SupabaseClient,
      service: { rpc, auth: { admin: { deleteUser } } } as unknown as SupabaseClient,
      rpc,
      deleteUser,
    };
  };

  it("writes org rows only for a genuinely new auth identity, passing the server-derived role", async () => {
    const t = mk(vi.fn().mockResolvedValue({ data: { user: { id: "u1", identities: [{}] } }, error: null }));
    expect(await registerOrganisation(t.auth, t.service, input, "http://x")).toEqual({ ok: true });
    expect(t.rpc).toHaveBeenCalledWith("create_org_signup", { p_user_id: "u1", p_org_name: "ZZ College", p_org_type: "institution", p_role: "tpo" });
  });
  it("writes nothing for an already-registered email (identity-less user)", async () => {
    const t = mk(vi.fn().mockResolvedValue({ data: { user: { id: "u1", identities: [] } }, error: null }));
    expect(await registerOrganisation(t.auth, t.service, input, "http://x")).toEqual({ ok: true });
    expect(t.rpc).not.toHaveBeenCalled();
  });
  it("rolls back the auth user if the org write fails", async () => {
    const t = mk(vi.fn().mockResolvedValue({ data: { user: { id: "u1", identities: [{}] } }, error: null }), vi.fn().mockResolvedValue({ error: { message: "boom" } }));
    expect((await registerOrganisation(t.auth, t.service, input, "http://x")).ok).toBe(false);
    expect(t.deleteUser).toHaveBeenCalledWith("u1");
  });
});

describe("migration 036", () => {
  const sql = readFileSync("supabase/migrations/036_org_onboarding.sql", "utf8");
  const fn = readFileSync("supabase/migrations/037_org_signup_name_conflict.sql", "utf8");
  it("keeps pending enforcement in the existing trigger function (allow-list) and adds no status column", () => {
    expect(sql).toMatch(/role not in \('student', 'professional'\)/);
    expect(sql).not.toMatch(/add column[^;]*status/i);
  });
  it("makes create_org_signup service-role only and matches names exactly, without fuzzy matching", () => {
    expect(sql).toMatch(/revoke all on function public\.create_org_signup[^;]*from public, anon, authenticated/);
    expect(fn).toMatch(/lower\(i\.name\) = lower\(clean_name\)/);
    expect(fn).toMatch(/revoke all on function public\.create_org_signup/);
    expect(sql + fn).not.toMatch(/similarity|levenshtein|pg_trgm|ilike|soundex/i);
  });
});
