import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";

// Real route handlers, real signed-in users, real RLS/storage — only the cookie-based server client is swapped for a
// token-based one (same approach as pipeline.live.test.ts). Disposable rows only; everything is removed afterwards.
const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client }));

import { POST as invite } from "@/app/api/org/invitations/route";
import { POST as revokeInvite } from "@/app/api/org/invitations/revoke/route";
import { POST as acceptInvite } from "@/app/api/invite/accept/route";
import { POST as setPerms } from "@/app/api/org/team/permissions/route";
import { POST as removeMember } from "@/app/api/org/team/remove/route";
import { POST as createJoinLink } from "@/app/api/org/join-links/route";
import { POST as toggleJoinLink } from "@/app/api/org/join-links/toggle/route";
import { POST as uploadMedia } from "@/app/api/org/media/route";
import { POST as postMaterial } from "@/app/api/org/materials/route";
import { POST as createPost } from "@/app/api/org/posts/route";
import { POST as editPost } from "@/app/api/org/posts/edit/route";
import { POST as postAction } from "@/app/api/org/posts/action/route";
import { POST as saveProfile } from "@/app/api/org/profile/route";
import { POST as sendMessage, GET as getMessages } from "@/app/api/org/chat/messages/route";
import { POST as createChannel } from "@/app/api/org/chat/channels/route";
import { POST as recordVisit } from "@/app/api/org/placements/route";
import { POST as setVisitStatus } from "@/app/api/org/placements/status/route";
import { POST as register } from "@/app/api/launchpad/apply/route";
import { POST as setApplicantStatus } from "@/app/api/org/applications/status/route";
import { POST as confirmPlacement } from "@/app/api/org/placements/confirm/route";
import { POST as attachLetter } from "@/app/api/org/offers/letter/route";
import { GET as openLetter } from "@/app/api/offer-letter/[placementId]/route";
import { POST as respondToOffer } from "@/app/api/classroom/placement-response/route";
import { getOrgContext } from "@/lib/org/context";
import { getOrgAdmin } from "@/lib/roadmap/admin-gate";

const service = liveServiceClient();
const svc = service as any;
const stamp = Date.now();
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false }, realtime: { transport: class {} as never } });

interface P {
  userId: string;
  email: string;
  password: string;
  membershipId: string;
  client: SupabaseClient;
}
let instA = "";
let instB = "";
const who: Record<string, P> = {};
const userIds: string[] = [];
const invitedEmails: string[] = [];

async function person(key: string, institutionId: string, role: string, branch: string | null, endYear = 2027, permissions: string[] | null = null): Promise<P> {
  const u = await createThrowawayUserWithLogin(service, `team-${key}`);
  userIds.push(u.userId);
  const { data, error } = await svc.from("institution_memberships").insert({ user_id: u.userId, institution_id: institutionId, role, branch, start_year: endYear - 4, end_year: endYear, permissions }).select("id").single();
  if (error) throw error;
  await svc.from("institution_memberships").update({ status: "active" }).eq("id", data.id);
  await svc.from("profiles").update({ full_name: `Team ${key}` }).eq("id", u.userId);
  const client = (await signedInClient(u.email, u.password)) as SupabaseClient;
  return (who[key] = { ...u, membershipId: data.id, client });
}

const as = (key: string) => {
  state.client = key === "anon" ? anon() : who[key].client;
};
type Handler = (r: Request) => Promise<Response>;
const json = (body: unknown) => new Request("http://localhost/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const call = async (h: Handler, key: string, body: unknown) => {
  as(key);
  const res = await h(json(body));
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
};
const callForm = async (h: Handler, key: string, form: FormData) => {
  as(key);
  const res = await h(new Request("http://localhost/api", { method: "POST", body: form }));
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
};

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const file = (bytes: Buffer, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });
const tokenOf = (url: unknown) => String(url).split("/invite/")[1];

beforeAll(async () => {
  for (const [n, slug] of [["A", `zz-team-a-${stamp}`], ["B", `zz-team-b-${stamp}`]] as const) {
    const { data } = await service.from("institutions").insert({ name: `ZZ Team ${n} ${stamp}`, slug }).select("id").single();
    if (n === "A") instA = data!.id;
    else instB = data!.id;
  }
  await person("admin", instA, "principal", null);
  await person("fac", instA, "faculty", "CSE");
  await person("holder", instA, "faculty", "CSE", 2027, ["students", "classroom", "members", "chat"]);
  await person("tpo", instA, "tpo", null);
  await person("sCSE", instA, "student", "CSE");
  await person("sECE", instA, "student", "ECE");
  await person("adminB", instB, "principal", null);
  await person("tpoB", instB, "tpo", null);
  await person("sB", instB, "student", "CSE");
}, 300_000);

afterAll(async () => {
  for (const bucket of ["org-media", "org-offers"]) {
    for (const inst of [instA, instB].filter(Boolean)) {
      const { data } = await service.storage.from(bucket).list(inst);
      if (data?.length) await service.storage.from(bucket).remove(data.map((f) => `${inst}/${f.name}`));
    }
  }
  await svc.from("opportunities").delete().in("institution_id", [instA, instB].filter(Boolean));
  const { error } = await service.from("institutions").delete().in("id", [instA, instB].filter(Boolean));
  if (error) throw new Error(`cleanup failed, test rows left in prod: ${error.message}`);
  for (const email of invitedEmails) {
    const { data } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
    if (data) await deleteThrowawayUser(service, data.id);
  }
  for (const id of userIds) await deleteThrowawayUser(service, id);
}, 300_000);

describe("invitations: an admin invites, the invitee creates their own account", () => {
  const email = `invitee-${stamp}@test.capabilio.invalid`;
  let url = "";
  let userId = "";

  it("only people with 'Team & access' can invite; nobody can escalate", async () => {
    expect((await call(invite, "fac", { email, role: "faculty" })).status).toBe(403); // no members permission
    expect((await call(invite, "sCSE", { email, role: "faculty" })).status).toBe(403);
    expect((await call(invite, "anon", { email, role: "faculty" })).status).toBe(401);
    expect((await call(invite, "holder", { email, role: "vice_principal" })).status).toBe(403); // can't mint admins
    expect((await call(invite, "holder", { email, role: "faculty", permissions: ["members"] })).status).toBe(403); // can't hand out Team & access
    expect((await call(invite, "holder", { email, role: "faculty", permissions: ["placements"] })).status).toBe(403); // doesn't hold it
    expect((await call(invite, "admin", { email, role: "principal" })).status).toBe(400); // not an invitable role
    expect((await call(invite, "admin", { email, role: "faculty", institutionId: instB })).status).toBe(400); // strict body
    expect((await call(invite, "admin", { email: who.fac.email, role: "faculty" })).status).toBe(409); // already has an account
  }, 60_000);

  it("creates an invitation whose token is stored only as a hash, and sending again replaces the old link", async () => {
    invitedEmails.push(email);
    const first = await call(invite, "admin", { email, role: "faculty", permissions: ["placements", "chat"] });
    expect(first.status).toBe(200);
    const firstUrl = String(first.body?.inviteUrl);
    expect(firstUrl).toContain("/invite/");
    const { data: row } = await svc.from("org_invitations").select("token_hash, permissions, institution_id").eq("email", email).is("revoked_at", null).single();
    expect(row.token_hash).not.toContain(tokenOf(firstUrl));
    expect(row.permissions).toEqual(["placements", "chat"]);
    expect(row.institution_id).toBe(instA);

    const second = await call(invite, "admin", { email, role: "faculty", permissions: ["placements", "chat"] });
    url = String(second.body?.inviteUrl);
    expect(url).not.toBe(firstUrl);
    expect((await call(acceptInvite, "anon", { token: tokenOf(firstUrl), fullName: "Old Link", password: "longenough1" })).status).toBe(410); // replaced
    const { data: open } = await svc.from("org_invitations").select("id").eq("email", email).is("accepted_at", null).is("revoked_at", null);
    expect(open).toHaveLength(1);
  }, 60_000);

  it("rejects bad tokens, wrong shapes and any attempt to set role or access while accepting", async () => {
    const good = { token: tokenOf(url), fullName: "Invited Person", password: "longenough1" };
    expect((await call(acceptInvite, "anon", { ...good, token: "x".repeat(43) })).status).toBe(410);
    expect((await call(acceptInvite, "anon", { ...good, role: "principal" })).status).toBe(400);
    expect((await call(acceptInvite, "anon", { ...good, permissions: ["members"] })).status).toBe(400);
    expect((await call(acceptInvite, "anon", { ...good, password: "short" })).status).toBe(400);
    const { data: still } = await svc.from("org_invitations").select("id").eq("email", email).is("accepted_at", null).is("revoked_at", null);
    expect(still).toHaveLength(1); // failed attempts never consume the invitation
  }, 60_000);

  it("accepting creates the account with exactly the invited role and permissions, and works once", async () => {
    const pw = "Invitee-pass-2026";
    const res = await call(acceptInvite, "anon", { token: tokenOf(url), fullName: "Invited Person", password: pw });
    expect(res.status).toBe(200);
    expect((await call(acceptInvite, "anon", { token: tokenOf(url), fullName: "Second Try", password: pw })).status).toBe(410);

    const client = (await signedInClient(email, pw)) as SupabaseClient;
    const { data: { user } } = await client.auth.getUser();
    userId = user!.id;
    const ctx = await getOrgContext(client as never, userId);
    expect(ctx).toMatchObject({ institutionId: instA, role: "faculty", kind: "staff" });
    expect([...ctx!.permissions].sort()).toEqual(["chat", "placements"]);
    const { data: profile } = await svc.from("profiles").select("full_name, primary_role").eq("id", userId).single();
    expect(profile).toMatchObject({ full_name: "Invited Person", primary_role: "faculty" });
    who.invitee = { userId, email, password: pw, membershipId: ctx!.membershipId, client };
  }, 90_000);

  it("an expired or cancelled invitation cannot be accepted", async () => {
    for (const [tag, patch] of [["expired", { expires_at: new Date(Date.now() - 1000).toISOString() }], ["cancelled", { revoked_at: new Date().toISOString() }]] as const) {
      const e = `late-${tag}-${stamp}@test.capabilio.invalid`;
      const made = await call(invite, "admin", { email: e, role: "hod" });
      expect(made.status).toBe(200);
      await svc.from("org_invitations").update(patch).eq("email", e);
      expect((await call(acceptInvite, "anon", { token: tokenOf(made.body?.inviteUrl), fullName: "Late Person", password: "longenough1" })).status, tag).toBe(410);
    }
    const e = `revoke-${stamp}@test.capabilio.invalid`;
    const made = await call(invite, "admin", { email: e, role: "hod" });
    const { data: row } = await svc.from("org_invitations").select("id").eq("email", e).single();
    expect((await call(revokeInvite, "fac", { invitationId: row.id })).status).toBe(403);
    expect((await call(revokeInvite, "adminB", { invitationId: row.id })).status).toBe(404); // another college's admin
    expect((await call(revokeInvite, "admin", { invitationId: row.id })).status).toBe(200);
    expect((await call(acceptInvite, "anon", { token: tokenOf(made.body?.inviteUrl), fullName: "Cancelled", password: "longenough1" })).status).toBe(410);
  }, 120_000);

  it("the new member can do exactly what they were given — and nothing else", async () => {
    const visit = { company: "ZZ Corp", role: "Analyst", opportunityType: "job" };
    expect((await call(recordVisit, "invitee", visit)).status).toBe(200); // placements: yes
    expect((await call(postMaterial, "invitee", { type: "link", title: "T", url: "https://x.co", branch: "CSE", year: 1 })).status).toBe(403); // classroom: no
    expect((await call(createPost, "invitee", { type: "announcement", body: "hi", publish: true })).status).toBe(403); // posts: no
    expect((await call(saveProfile, "invitee", { isPublic: true })).status).toBe(403); // page: no
    expect((await call(invite, "invitee", { email: `x-${stamp}@test.capabilio.invalid`, role: "faculty" })).status).toBe(403); // members: no
  }, 60_000);

  it("an admin can widen, narrow and remove access; admins are protected", async () => {
    const id = who.invitee.membershipId;
    expect((await call(setPerms, "fac", { membershipId: id, permissions: ["classroom"] })).status).toBe(403);
    expect((await call(setPerms, "adminB", { membershipId: id, permissions: ["classroom"] })).status).toBe(404); // other college
    expect((await call(setPerms, "admin", { membershipId: id, permissions: ["classroom", "hack"] })).status).toBe(400);
    expect((await call(setPerms, "admin", { membershipId: who.admin.membershipId, permissions: ["chat"] })).status).toBe(403); // not yourself
  }, 60_000);

  it("a non-admin who holds 'Team & access' still cannot grant permissions they don't hold", async () => {
    expect((await call(setPerms, "holder", { membershipId: who.tpo.membershipId, permissions: ["placements"] })).status).toBe(403); // holder lacks 'placements'
    expect((await call(setPerms, "holder", { membershipId: who.tpo.membershipId, permissions: ["students"] })).status).toBe(200); // but can pass on what they hold
    expect((await call(setPerms, "holder", { membershipId: who.admin.membershipId, permissions: ["chat"] })).status).toBe(403); // never touches an admin
    await svc.from("institution_memberships").update({ permissions: null }).eq("id", who.tpo.membershipId);
  }, 60_000);

  it("widening takes effect immediately; removal locks the person out and login says so", async () => {
    const id = who.invitee.membershipId;
    expect((await call(setPerms, "admin", { membershipId: id, permissions: ["classroom", "placements"] })).status).toBe(200);
    expect((await call(postMaterial, "invitee", { type: "link", title: "Notes", url: "https://x.co/n", branch: "CSE", year: 1 })).status).toBe(200);
    const ctx = await getOrgContext(who.invitee.client as never, who.invitee.userId);
    expect([...ctx!.permissions].sort()).toEqual(["classroom", "placements"]);

    expect((await call(removeMember, "fac", { membershipId: id })).status).toBe(403);
    expect((await call(removeMember, "admin", { membershipId: who.admin.membershipId })).status).toBe(403); // not yourself
    expect((await call(removeMember, "admin", { membershipId: id })).status).toBe(200);
    expect(await getOrgContext(who.invitee.client as never, who.invitee.userId)).toBeNull();
    expect((await call(recordVisit, "invitee", { company: "ZZ Late", role: "Analyst", opportunityType: "job" })).status).toBe(403);
    const { data } = await svc.from("institution_memberships").select("status").eq("id", id).single();
    expect(data.status).toBe("revoked");
  }, 90_000);

  it("the Curriculum permission opens the curriculum tools (and only that)", async () => {
    await svc.from("institution_memberships").update({ permissions: ["curriculum"], status: "active" }).eq("id", who.invitee.membershipId);
    const admin = await getOrgAdmin(who.invitee.client as never, who.invitee.userId);
    expect(admin?.institutionId).toBe(instA);
    await svc.from("institution_memberships").update({ permissions: ["chat"] }).eq("id", who.invitee.membershipId);
    expect(await getOrgAdmin(who.invitee.client as never, who.invitee.userId)).toBeNull();
  }, 60_000);
});

describe("student join links attribute sign-ups to the right college", () => {
  it("only the right people can create or switch a link", async () => {
    expect((await call(createJoinLink, "fac", { label: "CSE" })).status).toBe(403);
    expect((await call(createJoinLink, "sCSE", { label: "CSE" })).status).toBe(403);
    expect((await call(createJoinLink, "admin", { label: "CSE", institutionId: instB })).status).toBe(400);
    const ok = await call(createJoinLink, "admin", { label: "CSE 2027", branch: "CSE", endYear: 2027 });
    expect(ok.status).toBe(200);
    expect(String(ok.body?.url)).toMatch(/\/join\/[a-z0-9]{8,32}$/);
    const { data: link } = await svc.from("org_join_links").select("id, institution_id, branch, end_year").eq("code", String(ok.body?.code)).single();
    expect(link).toMatchObject({ institution_id: instA, branch: "CSE", end_year: 2027 });
    expect((await call(toggleJoinLink, "adminB", { linkId: link.id, active: false })).status).toBe(404); // not their college's link
  }, 60_000);

  it("a student who signs up through the link is counted; a code from another college or a switched-off link is not", async () => {
    const { data: links } = await svc.from("org_join_links").select("id, code").eq("institution_id", instA);
    const mine = links![0];
    const signupVia = async (label: string, collegeName: string, code: string) => {
      const { data, error } = await service.auth.admin.createUser({
        email: `joiner-${label}-${stamp}@test.capabilio.invalid`,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: `Joiner ${label}`, college_name: collegeName, branch: "CSE", start_year: "2024", end_year: "2028", role: "student", join_code: code },
      });
      if (error) throw error;
      userIds.push(data.user.id);
      return data.user.id;
    };
    const good = await signupVia("good", `ZZ Team A ${stamp}`, mine.code);
    const wrongCollege = await signupVia("wrong", `ZZ Team B ${stamp}`, mine.code);
    await svc.from("org_join_links").update({ active: false }).eq("id", mine.id);
    const off = await signupVia("off", `ZZ Team A ${stamp}`, mine.code);
    await svc.from("org_join_links").update({ active: true }).eq("id", mine.id);

    const { data: uses } = await svc.from("org_join_link_uses").select("user_id").eq("join_link_id", mine.id);
    expect((uses ?? []).map((u: { user_id: string }) => u.user_id)).toEqual([good]);
    // every one of them is still a normal student at the college they named (attribution never changes the account)
    for (const [uid, inst] of [[good, instA], [wrongCollege, instB], [off, instA]] as const) {
      const { data: m } = await svc.from("institution_memberships").select("institution_id, role, status").eq("user_id", uid).single();
      expect(m).toMatchObject({ institution_id: inst, role: "student", status: "active" });
    }
  }, 120_000);
});

describe("college pictures: uploads are checked, scoped and attached by the server", () => {
  it("logo and cover need the College-page permission, and only real images are accepted", async () => {
    const form = (kind: string, f: File) => {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", f);
      return fd;
    };
    expect((await callForm(uploadMedia, "fac", form("logo", file(PNG, "l.png", "image/png")))).status).toBe(403);
    expect((await callForm(uploadMedia, "anon", form("logo", file(PNG, "l.png", "image/png")))).status).toBe(401);
    expect((await callForm(uploadMedia, "admin", form("banner", file(PNG, "l.png", "image/png")))).status).toBe(400);
    expect((await callForm(uploadMedia, "admin", form("logo", file(Buffer.from("<svg onload=alert(1)/>"), "l.png", "image/png")))).status).toBe(415); // claims png, isn't
    expect((await callForm(uploadMedia, "admin", form("logo", file(Buffer.alloc(5 * 1024 * 1024 + 10, 1), "big.png", "image/png")))).status).toBe(413);

    const ok = await callForm(uploadMedia, "admin", form("logo", file(PNG, "l.png", "image/png")));
    expect(ok.status).toBe(200);
    const url = String(ok.body?.url);
    expect(url).toContain(`/org-media/${instA}/logo-`);
    const { data: prof } = await svc.from("org_profiles").select("logo_url").eq("institution_id", instA).single();
    expect(prof.logo_url).toBe(url);
    const served = await fetch(url);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toContain("image/png");

    // replacing the logo removes the old file and points the profile at the new one
    const second = await callForm(uploadMedia, "admin", form("logo", file(PNG, "l2.png", "image/png")));
    expect(second.status).toBe(200);
    // the old file is gone from storage (a CDN may keep serving its cached copy for a while, so check the bucket itself)
    const oldName = url.split("/").pop()!;
    const { data: listed } = await service.storage.from("org-media").list(instA);
    expect((listed ?? []).map((f) => f.name)).not.toContain(oldName);
    const cover = await callForm(uploadMedia, "admin", form("cover", file(PNG, "c.png", "image/png")));
    expect(cover.status).toBe(200);
    const { data: both } = await svc.from("org_profiles").select("logo_url, cover_image_url").eq("institution_id", instA).single();
    expect(both.logo_url).toBe(second.body?.url);
    expect(both.cover_image_url).toBe(cover.body?.url);
    // saving the profile text never wipes the pictures
    expect((await call(saveProfile, "admin", { isPublic: true, tagline: "Engineering since 1998", foundedYear: 1998, city: "Vijayawada", state: "Andhra Pradesh" })).status).toBe(200);
    const { data: after } = await svc.from("org_profiles").select("logo_url, cover_image_url, tagline, founded_year").eq("institution_id", instA).single();
    expect(after).toMatchObject({ logo_url: second.body?.url, cover_image_url: cover.body?.url, tagline: "Engineering since 1998", founded_year: 1998 });
    const { data: inst } = await service.from("institutions").select("city, state").eq("id", instA).single();
    expect(inst).toEqual({ city: "Vijayawada", state: "Andhra Pradesh" });
  }, 120_000);
});

describe("posts: photos must be this college's own uploads; edits are limited to your own posts", () => {
  it("rejects an external image link, accepts an own upload, lets authors (and admins) edit", async () => {
    expect((await call(createPost, "admin", { type: "announcement", body: "With outside image", coverImageUrl: "https://evil.example/pixel.png", publish: true })).status).toBe(400);

    const fd = new FormData();
    fd.append("kind", "post");
    fd.append("file", file(PNG, "p.png", "image/png"));
    expect((await callForm(uploadMedia, "tpo", fd)).status).toBe(403); // TPO has no Posts permission by default
    const fd2 = new FormData();
    fd2.append("kind", "post");
    fd2.append("file", file(PNG, "p.png", "image/png"));
    const up = await callForm(uploadMedia, "fac", fd2);
    expect(up.status).toBe(200);

    const made = await call(createPost, "fac", { type: "announcement", body: "Welcome back students\nSecond line", coverImageUrl: up.body?.url, publish: true, isPublic: true });
    expect(made.status).toBe(200);
    const { data: post } = await svc.from("org_posts").select("id, title, cover_image_url, author_membership_id, status").eq("institution_id", instA).eq("author_membership_id", who.fac.membershipId).single();
    expect(post).toMatchObject({ title: "Welcome back students", status: "published", cover_image_url: up.body?.url });

    expect((await call(editPost, "holder", { postId: post.id, body: "hijack" })).status).toBe(403); // no Posts permission
    expect((await call(editPost, "adminB", { postId: post.id, body: "hijack" })).status).toBe(404); // another college: the post doesn't exist for them
    expect((await call(editPost, "fac", { postId: post.id, body: "Edited by the author" })).status).toBe(200);
    expect((await call(editPost, "admin", { postId: post.id, body: "Edited by an admin" })).status).toBe(200);
    expect((await call(postAction, "fac", { postId: post.id, action: "unpublish" })).status).toBe(200);
    expect((await call(postAction, "fac", { postId: post.id, action: "delete" })).status).toBe(200);
  }, 120_000);
});

describe("team chat: private to the college's staff, channels respected", () => {
  let general = "";
  let priv = "";

  it("students and other colleges have no access; General exists for the team", async () => {
    expect((await call(sendMessage, "sCSE", { channelId: "00000000-0000-4000-8000-000000000000", body: "hi" })).status).toBe(403);
    const created = await call(createChannel, "admin", { name: "placement-cell", isPrivate: false });
    expect(created.status).toBe(200);
    const { data: chans } = await svc.from("org_chat_channels").select("id, name").eq("institution_id", instA);
    general = chans!.find((c: { name: string }) => c.name === "placement-cell")!.id;
    expect((await call(createChannel, "admin", { name: "Placement-Cell", isPrivate: false })).status).toBe(409); // names are unique per college, case-insensitively
    expect((await call(createChannel, "fac", { name: "x", isPrivate: true, memberUserIds: [] })).status).toBe(400);
  }, 60_000);

  it("staff talk; messages arrive in order; the other college cannot read or post", async () => {
    expect((await call(sendMessage, "fac", { channelId: general, body: "First" })).status).toBe(200);
    expect((await call(sendMessage, "tpo", { channelId: general, body: "Second" })).status).toBe(200);
    expect((await call(sendMessage, "adminB", { channelId: general, body: "Intruder" })).status).toBe(404);
    expect((await call(sendMessage, "fac", { channelId: general, body: "   " })).status).toBe(400);
    expect((await call(sendMessage, "fac", { channelId: general, body: "x".repeat(2001) })).status).toBe(400);

    as("admin");
    const all = (await (await getMessages(new Request(`http://localhost/api?channelId=${general}`))).json()) as { messages: { body: string; authorName: string; createdAt: string }[] };
    expect(all.messages.map((m) => m.body)).toEqual(["First", "Second"]);
    expect(all.messages[0].authorName).toBe("Team fac");

    as("adminB");
    expect((await getMessages(new Request(`http://localhost/api?channelId=${general}`))).status).toBe(404);

    // polling: only messages after a point in time
    const cursor = all.messages[0].createdAt;
    as("admin");
    const newer = (await (await getMessages(new Request(`http://localhost/api?channelId=${general}&after=${encodeURIComponent(cursor)}`))).json()) as { messages: { body: string }[] };
    expect(newer.messages.map((m) => m.body)).toEqual(["Second"]);
    expect((await getMessages(new Request("http://localhost/api?channelId=not-a-uuid"))).status).toBe(400);
  }, 90_000);

  it("a private channel is invisible to everyone not on it, and only chat-permitted staff of the college can be added", async () => {
    const made = await call(createChannel, "admin", { name: "leadership", isPrivate: true, memberUserIds: [who.holder.userId, who.sCSE.userId, who.adminB.userId] });
    expect(made.status).toBe(200);
    priv = String(made.body?.channelId);
    const { data: members } = await svc.from("org_chat_channel_members").select("user_id").eq("channel_id", priv);
    const ids = (members ?? []).map((m: { user_id: string }) => m.user_id).sort();
    expect(ids).toEqual([who.admin.userId, who.holder.userId].sort()); // the student and the other college's admin were dropped

    expect((await call(sendMessage, "holder", { channelId: priv, body: "Budget" })).status).toBe(200);
    expect((await call(sendMessage, "fac", { channelId: priv, body: "Let me in" })).status).toBe(404); // same college, not a member
    as("fac");
    expect((await getMessages(new Request(`http://localhost/api?channelId=${priv}`))).status).toBe(404);
  }, 90_000);

  it("chat access is a permission: without it, the API says no", async () => {
    await svc.from("institution_memberships").update({ permissions: ["students"] }).eq("id", who.holder.membershipId);
    expect((await call(sendMessage, "holder", { channelId: general, body: "nope" })).status).toBe(403);
    await svc.from("institution_memberships").update({ permissions: ["students", "classroom", "members", "chat"] }).eq("id", who.holder.membershipId);
  }, 60_000);
});

describe("company visits: registration rules, offer letters and the student's answer", () => {
  let visitId = "";
  let appId = "";
  let placementId = "";

  it("a college records a confirmed company visit; students of other branches and colleges cannot register", async () => {
    expect((await call(recordVisit, "fac", { company: "ZZ Infosys", role: "Systems Engineer", opportunityType: "job" })).status).toBe(403);
    const made = await call(recordVisit, "tpo", {
      company: "ZZ Infosys",
      role: "Systems Engineer",
      opportunityType: "job",
      ctcOffered: "₹4.5–8 LPA",
      driveDate: "2099-12-01",
      deadline: "2099-11-20",
      eligibleBranches: ["CSE"],
      status: "planned",
    });
    expect(made.status).toBe(200);
    visitId = String(made.body?.visitId);
    const { data: row } = await svc.from("opportunities").select("institution_id, drive_status, eligible_branches, ctc_offered, drive_date").eq("id", visitId).single();
    expect(row).toMatchObject({ institution_id: instA, drive_status: "planned", eligible_branches: ["CSE"], ctc_offered: "₹4.5–8 LPA", drive_date: "2099-12-01" });

    expect((await call(register, "sCSE", { opportunityId: visitId })).status).toBe(409); // planned: not open yet
    expect((await call(setVisitStatus, "fac", { opportunityId: visitId, status: "registration_open" })).status).toBe(403);
    expect((await call(setVisitStatus, "tpoB", { opportunityId: visitId, status: "registration_open" })).status).toBe(404);
    expect((await call(setVisitStatus, "tpo", { opportunityId: visitId, status: "registration_open" })).status).toBe(200);

    expect((await call(register, "sECE", { opportunityId: visitId })).status).toBe(403); // branch not eligible
    expect((await call(register, "sB", { opportunityId: visitId })).status).toBe(404); // other college
    expect((await call(register, "sCSE", { opportunityId: visitId })).status).toBe(200);
    expect((await call(register, "sCSE", { opportunityId: visitId })).status).toBe(200); // idempotent
    const { data: apps } = await svc.from("applications").select("id, status").eq("opportunity_id", visitId);
    expect(apps).toHaveLength(1);
    appId = apps![0].id;

    expect((await call(setVisitStatus, "tpo", { opportunityId: visitId, status: "cancelled" })).status).toBe(200);
    expect((await call(register, "sECE", { opportunityId: visitId })).status).toBe(409); // cancelled
    expect((await call(setVisitStatus, "tpo", { opportunityId: visitId, status: "registration_open" })).status).toBe(200);
  }, 120_000);

  it("select → release the offer → attach a private letter → only the student and the college's officers can open it", async () => {
    expect((await call(setApplicantStatus, "tpo", { applicationId: appId, status: "accepted" })).status).toBe(200);
    const confirmed = await call(confirmPlacement, "tpo", { applicationId: appId, ctcLpa: 6.5, offerDate: "2026-09-20" });
    expect(confirmed.status).toBe(200);
    placementId = String(confirmed.body?.placementId);

    const letter = (key: string, f: File, id = placementId) => {
      const fd = new FormData();
      fd.append("placementId", id);
      fd.append("file", f);
      return callForm(attachLetter, key, fd);
    };
    expect((await letter("fac", file(PDF, "offer.pdf", "application/pdf"))).status).toBe(403);
    expect((await letter("tpoB", file(PDF, "offer.pdf", "application/pdf"))).status).toBe(404); // another college's placement
    expect((await letter("tpo", file(Buffer.from("MZ executable"), "offer.pdf", "application/pdf"))).status).toBe(415);
    expect((await letter("tpo", file(PDF, "offer.pdf", "application/pdf"))).status).toBe(200);

    const open = async (key: string) => {
      as(key);
      return openLetter(new Request("http://localhost/api"), { params: Promise.resolve({ placementId }) });
    };
    for (const key of ["sCSE", "tpo", "admin"]) {
      const res = await open(key);
      expect(res.status, key).toBe(307);
      const location = res.headers.get("location")!;
      expect(location).toContain("/object/sign/org-offers/");
      const served = await fetch(location);
      expect(served.status).toBe(200);
      expect(served.headers.get("content-type")).toContain("pdf");
    }
    for (const key of ["sECE", "tpoB", "adminB", "sB", "fac"]) expect((await open(key)).status, key).toBe(404); // existence is not confirmed to outsiders
    as("anon");
    expect((await openLetter(new Request("http://localhost/api"), { params: Promise.resolve({ placementId }) })).status).toBe(401);
    // the private bucket has no public URL
    const direct = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-offers/${instA}/${placementId}.pdf`);
    expect(direct.status).not.toBe(200);
  }, 180_000);

  it("the student answers their own offer; nobody else can answer for them", async () => {
    expect((await call(respondToOffer, "sECE", { placementId, response: "accepted" })).status).toBe(404);
    expect((await call(respondToOffer, "tpo", { placementId, response: "accepted" })).status).toBe(403);
    expect((await call(respondToOffer, "sCSE", { placementId, response: "maybe" })).status).toBe(400);
    expect((await call(respondToOffer, "sCSE", { placementId, response: "accepted" })).status).toBe(200);
    const { data } = await svc.from("org_placements").select("student_response, responded_at").eq("id", placementId).single();
    expect(data.student_response).toBe("accepted");
    expect(data.responded_at).not.toBeNull();
  }, 60_000);
});
