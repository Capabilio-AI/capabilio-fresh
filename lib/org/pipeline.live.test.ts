import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";

// The real route handlers, run as real signed-in users against the live project. Only the cookie-based
// server client is swapped for a token-based one (the session store is the sole difference), so RLS,
// column grants, the service client and every authority check are the production ones.
const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client }));

import { POST as postDrive } from "@/app/api/org/placements/route";
import { POST as apply } from "@/app/api/launchpad/apply/route";
import { POST as setStatus } from "@/app/api/org/applications/status/route";
import { POST as confirmPlacement } from "@/app/api/org/placements/confirm/route";
import { POST as consent } from "@/app/api/classroom/placement-consent/route";
import { POST as rsvp } from "@/app/api/orgs/rsvp/route";
import { POST as createPost } from "@/app/api/org/posts/route";
import { POST as saveProfile } from "@/app/api/org/profile/route";
import { GET as exportCsv } from "@/app/api/org/outcomes/export/route";
import { loadPlacementWall, loadPublicOrg } from "@/lib/org/public-org";

const service = liveServiceClient();
// the new tables postdate the generated types
const svc = service as unknown as SupabaseClient;
const stamp = Date.now();
const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false }, realtime: { transport: class {} as never } });

interface P {
  userId: string;
  email: string;
  password: string;
  membershipId: string;
  client: SupabaseClient;
}
let instA = "";
let instB = "";
let slugA = "";
const who: Record<string, P> = {};
const userIds: string[] = [];

async function person(key: string, institutionId: string, role: string, branch: string | null, endYear = 2027): Promise<P> {
  const u = await createThrowawayUserWithLogin(service, `pipe-${key}`);
  userIds.push(u.userId);
  const { data, error } = await service
    .from("institution_memberships")
    .insert({ user_id: u.userId, institution_id: institutionId, role: role as never, branch, start_year: endYear - 4, end_year: endYear })
    .select("id")
    .single();
  if (error) throw error;
  await service.from("institution_memberships").update({ status: "active" }).eq("id", data.id);
  const client = (await signedInClient(u.email, u.password)) as SupabaseClient;
  return (who[key] = { ...u, membershipId: data.id, client });
}

const as = (key: string | "anon") => {
  state.client = key === "anon" ? anon() : who[key].client;
};
const req = (body: unknown) => new Request("http://localhost/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const call = async (handler: (r: Request) => Promise<Response>, key: string, body: unknown) => {
  as(key);
  const res = await handler(req(body));
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
};

beforeAll(async () => {
  slugA = `zz-pipe-a-${stamp}`;
  for (const [n, slug] of [["A", slugA], ["B", `zz-pipe-b-${stamp}`]] as const) {
    const { data } = await service.from("institutions").insert({ name: `ZZ Pipeline ${n} ${stamp}`, slug }).select("id").single();
    if (n === "A") instA = data!.id;
    else instB = data!.id;
  }
  await person("tpo", instA, "faculty", null);
  await service.from("institution_memberships").update({ role: "tpo" as never }).eq("id", who.tpo.membershipId);
  await person("admin", instA, "principal", null);
  await person("staff", instA, "faculty", "CSE");
  await person("s1", instA, "student", "CSE");
  await person("s2", instA, "student", "ECE");
  await person("early", instA, "student", "CSE", 2030); // outside the final-two-years Launchpad window
  await person("tpoB", instB, "faculty", null);
  await service.from("institution_memberships").update({ role: "tpo" as never }).eq("id", who.tpoB.membershipId);
  await person("sB", instB, "student", "CSE");
}, 300_000);

afterAll(async () => {
  // opportunities.institution_id is ON DELETE SET NULL: without this a deleted college's drive would turn into a public listing
  await service.from("opportunities").delete().in("institution_id", [instA, instB].filter(Boolean));
  const { error } = await service.from("institutions").delete().in("id", [instA, instB].filter(Boolean));
  if (error) console.error("CLEANUP institutions:", error.message);
  for (const id of userIds) await deleteThrowawayUser(service, id);
}, 300_000);

describe("placement pipeline (real routes, real RLS)", () => {
  let driveId = "";
  let appId = "";

  it("only TPO/admin can post a drive, and it is pinned to their own institution", async () => {
    const drive = { company: "ZZ Corp", role: "Analyst", opportunityType: "job", skills: ["sql"], deadline: "2099-12-31" };
    for (const k of ["staff", "s1"]) expect((await call(postDrive, k, drive)).status, k).toBe(403);
    expect((await call(postDrive, "anon", drive)).status).toBe(401);
    expect((await call(postDrive, "tpo", { ...drive, institutionId: instB })).status).toBe(400); // strict body
    expect((await call(postDrive, "tpo", drive)).status).toBe(200);
    const { data } = await service.from("opportunities").select("id, institution_id, created_by").eq("company", "ZZ Corp").eq("institution_id", instA);
    expect(data).toHaveLength(1);
    driveId = data![0].id;
    expect(data![0].created_by).toBe(who.tpo.userId);
  }, 60_000);

  it("private drive is visible to its college's students only", async () => {
    const a = await who.s1.client.from("opportunities").select("id").eq("id", driveId);
    const b = await who.sB.client.from("opportunities").select("id").eq("id", driveId);
    expect(a.data).toHaveLength(1);
    expect(b.data).toHaveLength(0);
  });

  it("students apply to their own college's drive only, inside their window, once", async () => {
    expect((await call(apply, "s1", { opportunityId: driveId })).status).toBe(200);
    expect((await call(apply, "s1", { opportunityId: driveId })).status).toBe(200); // idempotent
    expect((await call(apply, "sB", { opportunityId: driveId })).status).toBe(404);
    expect((await call(apply, "early", { opportunityId: driveId })).status).toBe(403);
    expect((await call(apply, "staff", { opportunityId: driveId })).status).toBe(403);
    expect((await call(apply, "s1", { opportunityId: driveId, status: "accepted" })).status).toBe(400);
    const { data } = await service.from("applications").select("id, user_id, status").eq("opportunity_id", driveId);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ user_id: who.s1.userId, status: "submitted" });
    appId = data![0].id;
  }, 90_000);

  it("a raw client cannot write applications, placements or other pipeline tables", async () => {
    const c = who.s1.client;
    expect((await c.from("applications").update({ status: "accepted" }).eq("id", appId).select("id")).error).not.toBeNull();
    expect((await c.from("applications").insert({ opportunity_id: driveId, user_id: who.s2.userId })).error).not.toBeNull();
    expect((await c.from("applications").delete().eq("id", appId)).error).not.toBeNull();
    expect((await c.from("org_placements").insert({ institution_id: instA, student_user_id: who.s1.userId, company: "X", role_title: "Y", confirmed_by_membership_id: who.tpo.membershipId })).error).not.toBeNull();
    expect((await c.from("org_placements").select("*")).error).not.toBeNull();
    expect((await c.from("org_event_rsvps").insert({ post_id: driveId, user_id: who.s1.userId })).error).not.toBeNull();
    // the student can still READ their own application
    const own = await c.from("applications").select("status").eq("id", appId);
    expect(own.data).toEqual([{ status: "submitted" }]);
    const { data } = await service.from("applications").select("status").eq("id", appId).single();
    expect(data!.status).toBe("submitted");
  }, 60_000);

  it("only the drive's college TPO/admin moves applicants; others are refused", async () => {
    expect((await call(setStatus, "s1", { applicationId: appId, status: "accepted" })).status).toBe(403);
    expect((await call(setStatus, "staff", { applicationId: appId, status: "accepted" })).status).toBe(403);
    expect((await call(setStatus, "tpoB", { applicationId: appId, status: "accepted" })).status).toBe(404);
    expect((await call(setStatus, "tpo", { applicationId: appId, status: "hired" })).status).toBe(400);
    expect((await call(setStatus, "tpo", { applicationId: appId, status: "shortlisted" })).status).toBe(200);
    const { data } = await service.from("applications").select("status").eq("id", appId).single();
    expect(data!.status).toBe("shortlisted");
  }, 60_000);

  it("a placement needs a selected applicant, an active student of the SAME college, and an officer", async () => {
    expect((await call(confirmPlacement, "tpo", { applicationId: appId })).status).toBe(409); // still only shortlisted
    expect((await call(setStatus, "admin", { applicationId: appId, status: "accepted" })).status).toBe(200);
    expect((await call(confirmPlacement, "s1", { applicationId: appId })).status).toBe(403);
    expect((await call(confirmPlacement, "tpoB", { applicationId: appId })).status).toBe(404);
    // off-campus path: a student of another college can't be "placed" by this college
    expect((await call(confirmPlacement, "tpo", { studentUserId: who.sB.userId, company: "C", roleTitle: "R" })).status).toBe(404);
    expect((await call(confirmPlacement, "tpo", { studentUserId: who.tpo.userId, company: "C", roleTitle: "R" })).status).toBe(404); // not a student
    expect((await call(confirmPlacement, "tpo", { applicationId: appId, ctcLpa: 8.5, offerDate: "2026-09-01" })).status).toBe(200);
    expect((await call(confirmPlacement, "tpo", { applicationId: appId, ctcLpa: 9 })).status).toBe(200); // idempotent per (student, company, role)
    const { data } = await svc.from("org_placements").select("*").eq("institution_id", instA);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ student_user_id: who.s1.userId, company: "ZZ Corp", role_title: "Analyst", show_on_wall: false, confirmed_by_membership_id: who.tpo.membershipId });
    expect(Number(data![0].ctc_lpa)).toBe(9);
  }, 120_000);

  it("the student alone controls the Placement Wall; pay is never public", async () => {
    const { data } = await svc.from("org_placements").select("id").eq("institution_id", instA).single();
    expect((await call(consent, "s2", { placementId: data!.id, show: true })).status).toBe(404); // someone else's placement
    expect((await call(consent, "tpo", { placementId: data!.id, show: true })).status).toBe(403); // officers cannot consent for a student
    expect((await loadPlacementWall(service, instA)).length).toBe(0);
    expect((await call(consent, "s1", { placementId: data!.id, show: true })).status).toBe(200);
    const wall = await loadPlacementWall(service, instA);
    expect(wall).toHaveLength(1);
    expect(Object.keys(wall[0]).sort()).toEqual(["company", "id", "name", "roleTitle"]);
    await call(consent, "s1", { placementId: data!.id, show: false });
    expect((await loadPlacementWall(service, instA)).length).toBe(0);
  }, 90_000);

  it("CSV export is scoped to the caller's own college and to TPO/admin", async () => {
    as("s1");
    expect((await exportCsv()).status).toBe(403);
    as("staff");
    expect((await exportCsv()).status).toBe(403);
    as("tpoB");
    expect(await (await exportCsv()).text()).not.toContain("ZZ Corp");
    as("tpo");
    const ok = await exportCsv();
    expect(ok.status).toBe(200);
    const text = await ok.text();
    expect(text).toContain("ZZ Corp");
    expect(text.split("\n")[0]).toBe("Student,Branch,Company,Role,CTC (LPA),Offer date,Confirmed on");
  }, 60_000);
});

describe("events: RSVP follows the same visibility rules as the page", () => {
  let postId = "";
  it("RSVP works for a member, is refused for an outsider while the page is private, and opens up when it goes public", async () => {
    expect((await call(createPost, "staff", { type: "event", title: "ZZ Talk", body: "b", eventStartsAt: "2099-01-01T10:00:00.000Z", publish: true })).status).toBe(200);
    const { data } = await svc.from("org_posts").select("id").eq("institution_id", instA).single();
    postId = (data as { id: string }).id;

    expect((await call(rsvp, "s1", { postId, going: true })).status).toBe(200); // member
    expect((await call(rsvp, "sB", { postId, going: true })).status).toBe(404); // page not public yet
    expect((await call(rsvp, "anon", { postId, going: true })).status).toBe(401);

    expect((await call(saveProfile, "staff", { isPublic: true })).status).toBe(403); // only admin manages the page
    expect((await call(saveProfile, "admin", { isPublic: true, bio: "hello" })).status).toBe(200);
    expect((await call(rsvp, "sB", { postId, going: true })).status).toBe(200);

    const { count } = await svc.from("org_event_rsvps").select("*", { count: "exact", head: true }).eq("post_id", postId);
    expect(count).toBe(2);
    expect((await call(rsvp, "sB", { postId, going: false })).status).toBe(200);
  }, 120_000);

  it("the public org page is derived-verified (an approved TPO/admin exists) and opt-in", async () => {
    const org = await loadPublicOrg(service, slugA, null);
    expect(org).toMatchObject({ verified: true, name: `ZZ Pipeline A ${stamp}` });
    expect(org!.studentCount).toBeGreaterThanOrEqual(3);
    await call(saveProfile, "admin", { isPublic: false });
    expect(await loadPublicOrg(service, slugA, null)).toBeNull();
  }, 60_000);
});
