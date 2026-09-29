import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { liveServiceClient, deleteThrowawayUser } from "@/lib/arena-workstations/live-test-helpers";
import { OrgSignupSchema, roleFor } from "./signup";

// Runs against the live project with disposable users/orgs (npm run test:live). Everything is deleted afterwards.
const service = liveServiceClient();
const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
    realtime: { transport: class {} as never },
  });
const stamp = Date.now();
const orgName = `ZZ Org Test ${stamp}`;
const emails: string[] = [];
const userIds: string[] = [];

// Supabase's built-in mailer allows only a few signUp confirmation emails per hour, so live tests create the
// auth user with the admin API (no email; same auth.users trigger) and then call the same server RPC the
// route calls. The route's signUp -> RPC ordering is covered by unit tests with mocked clients.
async function signup(over: Record<string, unknown>) {
  const email = `org-${emails.length}-${stamp}@test.capabilio.invalid`;
  emails.push(email);
  const input = OrgSignupSchema.parse({ orgType: "institution", orgName, fullName: "ZZ Tester", designation: "tpo", email, password: crypto.randomUUID(), ...over });
  const { data: created } = await service.auth.admin.createUser({ email, password: input.password, user_metadata: { full_name: input.fullName } });
  const userId = created.user!.id;
  userIds.push(userId);
  const { error } = await service.rpc("create_org_signup" as never, { p_user_id: userId, p_org_name: input.orgName, p_org_type: input.orgType, p_role: roleFor(input) } as never);
  if (error?.message.includes("name_taken_other_type")) {
    await service.auth.admin.deleteUser(userId);
    userIds.pop();
    return { res: { ok: false, status: 409 }, userId: undefined };
  }
  return { res: { ok: !error, status: error ? 500 : 200 }, userId };
}

afterAll(async () => {
  for (const id of userIds) {
    await service.from("institution_memberships").delete().eq("user_id", id);
    await deleteThrowawayUser(service, id);
  }
  await service.from("institutions").delete().ilike("name", `ZZ Org Test ${stamp}%`);
});

describe("organisation signup (live)", () => {
  it("creates a PENDING membership via the existing trigger and a new institution row", async () => {
    const { res, userId } = await signup({});
    expect(res.ok).toBe(true);
    const { data: m } = await service.from("institution_memberships").select("role,status,institutions(name,org_type)").eq("user_id", userId!).single();
    expect(m?.role).toBe("tpo");
    expect(m?.status).toBe("pending");
    expect(m?.institutions).toMatchObject({ name: orgName, org_type: "institution" });
  });

  it("links a second signup to the same institution on exact case-insensitive name; no duplicate row", async () => {
    const { userId } = await signup({ orgName: `  ${orgName.toUpperCase()} `, designation: "principal" });
    const { data: rows } = await service.from("institutions").select("id").ilike("name", orgName);
    expect(rows).toHaveLength(1);
    const { data: m } = await service.from("institution_memberships").select("institution_id,status").eq("user_id", userId!).single();
    expect(m?.institution_id).toBe(rows![0].id);
    expect(m?.status).toBe("pending");
  });

  it("does NOT fuzzy-match a typo'd name (creates a separate row)", async () => {
    await signup({ orgName: `${orgName}x` });
    const { data: rows } = await service.from("institutions").select("id").ilike("name", `ZZ Org Test ${stamp}%`);
    expect(rows).toHaveLength(2);
  });

  it("a company cannot reuse an institution's exact name (no cross-type link, clear error, no orphan user)", async () => {
    const { res, userId } = await signup({ orgType: "company", designation: undefined });
    expect(res).toMatchObject({ ok: false, status: 409 });
    expect(userId).toBeUndefined();
  });

  it("company signup is pending, role company_admin, org_type company", async () => {
    const { res, userId } = await signup({ orgType: "company", designation: undefined, orgName: `${orgName} Co` });
    expect(res.ok).toBe(true);
    const { data: m } = await service.from("institution_memberships").select("role,status,institutions(org_type)").eq("user_id", userId!).single();
    expect(m).toMatchObject({ role: "company_admin", status: "pending", institutions: { org_type: "company" } });
  });

  it("a pending org account is signed in but has no active membership", async () => {
    const { userId } = await signup({ orgName: `${orgName} pending` });
    const { data } = await service.from("institution_memberships").select("id").eq("user_id", userId!).eq("status", "active");
    expect(data).toHaveLength(0);
  });
});

describe("client authority (raw client attacks, same pattern as Job-Track direct-write tests)", () => {
  it("raw auth.signUp with role/org metadata never yields a privileged or active org account", async () => {
    const email = `org-attack-${stamp}@test.capabilio.invalid`;
    const { data: created } = await service.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      user_metadata: { role: "principal", org_type: "institution", status: "active", college_name: `${orgName} attack`, full_name: "ZZ" },
    });
    expect(created.user).toBeTruthy();
    const { data: p } = await service.from("profiles").select("id,primary_role").eq("email", email).single();
    userIds.push(p!.id);
    expect(p?.primary_role).toBe("student");
    const { data: m } = await service.from("institution_memberships").select("role,status").eq("user_id", p!.id);
    expect(m?.every((r) => r.role === "student")).toBe(true);
  });

  it("clients cannot call create_org_signup or write institutions.org_type", async () => {
    const { userId } = await signup({ orgName: `${orgName} authority` });
    const email = emails.at(-1)!;
    await service.auth.admin.updateUserById(userId!, { email_confirm: true });
    const c = anon();
    await c.auth.signInWithPassword({ email, password: "irrelevant" }); // wrong pw: stays an anonymous public-key client
    const rpc = await c.rpc("create_org_signup" as never, { p_user_id: userId, p_org_name: "ZZ", p_org_type: "institution", p_role: "principal" } as never);
    expect(rpc.error).not.toBeNull();
    const upd = await c.from("institutions").update({ org_type: "company" }).eq("name", orgName).select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("the service function refuses an already-promoted user and a role that doesn't fit the org type", async () => {
    const { userId } = await signup({ orgName: `${orgName} guard` });
    const again = await service.rpc("create_org_signup" as never, { p_user_id: userId, p_org_name: "ZZ Org Test guard2", p_org_type: "institution", p_role: "tpo" } as never);
    expect(again.error).not.toBeNull();
    const bad = await service.rpc("create_org_signup" as never, { p_user_id: userId, p_org_name: "ZZ Org Test guard3", p_org_type: "company", p_role: "principal" } as never);
    expect(bad.error).not.toBeNull();
  });
});

describe("manual approval (scripts/org-approvals.mjs)", () => {
  const run = (...args: string[]) => execFileSync("node", ["--env-file=.env.local", "scripts/org-approvals.mjs", ...args], { encoding: "utf8" });

  it("refuses unconfirmed email, then activates a confirmed pending institution account who can then log in", async () => {
    const { userId } = await signup({ orgName: `${orgName} approve` });
    const { data: m } = await service.from("institution_memberships").select("id").eq("user_id", userId!).single();
    expect(run("list")).toContain(m!.id);
    expect(() => run("approve", m!.id)).toThrow(/Email not confirmed/);

    await service.auth.admin.updateUserById(userId!, { email_confirm: true, password: "Approve-me-1234" });
    const email = emails.at(-1)!;
    const c = anon();
    await c.auth.signInWithPassword({ email, password: "Approve-me-1234" });
    const active = () => c.from("institution_memberships").select("status").eq("status", "active");
    expect((await active()).data).toHaveLength(0); // pending: login screen's "pending-approval" branch

    run("approve", m!.id);
    expect((await active()).data).toHaveLength(1); // approved: the same universal login now succeeds
  });
});
