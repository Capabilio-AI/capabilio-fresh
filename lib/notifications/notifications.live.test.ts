import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";

// Real route handlers + real signed-in users + the real notifications table (migration 118 must be applied).
// Disposable rows only; everything is removed afterwards.
const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client }));

import { GET as listNotifications } from "@/app/api/notifications/route";
import { POST as markRead } from "@/app/api/notifications/read/route";
import { POST as createPost } from "@/app/api/org/posts/route";
import { POST as createProject } from "@/app/api/org/projects/route";
import { POST as changeRole } from "@/app/api/org/team/role/route";

const service = liveServiceClient();
const svc = service as any;
const stamp = Date.now();

interface P { userId: string; client: SupabaseClient; membershipId: string }
const who: Record<string, P> = {};
const userIds: string[] = [];
let instA = "";
let instB = "";

async function person(key: string, inst: string, role: string, branch: string | null): Promise<void> {
  const u = await createThrowawayUserWithLogin(service, `ntf-${key}`);
  userIds.push(u.userId);
  const { data, error } = await svc.from("institution_memberships").insert({ user_id: u.userId, institution_id: inst, role, branch, start_year: 2023, end_year: 2027 }).select("id").single();
  if (error) throw error;
  await svc.from("institution_memberships").update({ status: "active" }).eq("id", data.id);
  await svc.from("profiles").update({ full_name: `Ntf ${key}` }).eq("id", u.userId);
  who[key] = { userId: u.userId, client: (await signedInClient(u.email, u.password)) as SupabaseClient, membershipId: data.id };
}

const as = (key: string) => {
  state.client = who[key].client;
};
const post = async (h: (r: Request) => Promise<Response>, key: string, body: unknown) => {
  as(key);
  const res = await h(new Request("http://localhost/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> | null };
};
const get = async (key: string, qs = "") => {
  as(key);
  const res = await listNotifications(new Request(`http://localhost/api/notifications${qs}`));
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};
const stored = async (userId: string, type: string) => ((await svc.from("notifications").select("*").eq("user_id", userId).eq("type", type)).data ?? []) as any[];

beforeAll(async () => {
  for (const [n, slug] of [["A", `zz-ntf-a-${stamp}`], ["B", `zz-ntf-b-${stamp}`]] as const) {
    const { data } = await service.from("institutions").insert({ name: `ZZ Ntf ${n} ${stamp}`, slug }).select("id").single();
    if (n === "A") instA = data!.id;
    else instB = data!.id;
  }
  await person("admin", instA, "principal", null);
  await person("fac", instA, "faculty", "CSE");
  await person("sCSE", instA, "student", "CSE");
  await person("sECE", instA, "student", "ECE");
  await person("sB", instB, "student", "CSE");
}, 300_000);

afterAll(async () => {
  await svc.from("class_projects").delete().in("institution_id", [instA, instB].filter(Boolean));
  const { error } = await service.from("institutions").delete().in("id", [instA, instB].filter(Boolean));
  if (error) throw new Error(`cleanup failed, test rows left in prod: ${error.message}`);
  for (const id of userIds) await deleteThrowawayUser(service, id);
}, 300_000);

describe("events create notifications for the right people", () => {
  it("a new project reaches students in its department only, and never the author or another college", async () => {
    const r = await post(createProject, "admin", { title: `Ntf project ${stamp}`, brief: "Build something useful for the college.", departmentScope: ["CSE"], submissionType: "in_app", weeklyReportRequired: false, deadlineAt: new Date(Date.now() + 14 * 86400000).toISOString() });
    expect(r.status).toBe(200);
    expect(await stored(who.sCSE.userId, "project_posted")).toHaveLength(1);
    expect(await stored(who.sECE.userId, "project_posted")).toHaveLength(0);
    expect(await stored(who.sB.userId, "project_posted")).toHaveLength(0);
    expect(await stored(who.admin.userId, "project_posted")).toHaveLength(0);
  }, 60_000);

  it("a published announcement reaches every student of the college once", async () => {
    const r = await post(createPost, "admin", { type: "announcement", body: "Welcome everyone", publish: true, isPublic: false });
    expect(r.status).toBe(200);
    for (const k of ["sCSE", "sECE"]) expect(await stored(who[k].userId, "post_announcement")).toHaveLength(1);
    expect(await stored(who.sB.userId, "post_announcement")).toHaveLength(0);
  }, 60_000);

  it("a draft notifies nobody", async () => {
    await post(createPost, "admin", { type: "announcement", body: "Draft only", publish: false, isPublic: false });
    expect(await stored(who.sCSE.userId, "post_announcement")).toHaveLength(1); // still just the published one
  }, 60_000);

  it("changing someone's role tells them", async () => {
    const r = await post(changeRole, "admin", { membershipId: who.fac.membershipId, role: "hod", permissions: null });
    expect(r.status).toBe(200);
    expect(await stored(who.fac.userId, "role_changed")).toHaveLength(1);
  }, 60_000);
});

describe("reading your notifications", () => {
  it("lists only your own, newest first, with the unread count", async () => {
    const mine = await get("sCSE");
    expect(mine.status).toBe(200);
    expect(mine.body.unread).toBe(2);
    expect(mine.body.items).toHaveLength(2);
    expect(mine.body.items.every((n: any) => n.read === false)).toBe(true);
    expect(new Date(mine.body.items[0].createdAt) >= new Date(mine.body.items[1].createdAt)).toBe(true);
    expect((await get("sB")).body.unread).toBe(0);
    expect((await get("sCSE", "?countOnly=1")).body).toEqual({ unread: 2 });
    expect((await get("sCSE", "?limit=500")).status).toBe(400);
  }, 60_000);

  it("marks one as read, ignores other people's ids, then marks all", async () => {
    const mine = await get("sCSE");
    const first = mine.body.items[0].id;
    const other = (await get("sECE")).body.items[0].id;
    expect((await post(markRead, "sCSE", { ids: [first, other] })).status).toBe(200);
    expect((await get("sCSE")).body.unread).toBe(1);
    expect((await get("sECE")).body.unread).toBe(1); // sCSE could not touch sECE's
    expect((await post(markRead, "sCSE", { all: true })).status).toBe(200);
    expect((await get("sCSE")).body.unread).toBe(0);
    expect((await post(markRead, "sCSE", { everything: true })).status).toBe(400);
  }, 60_000);

  it("the same action repeated never doubles a notification", async () => {
    const { notify } = await import("./notify");
    for (let i = 0; i < 3; i++) await notify(service, { userIds: [who.sECE.userId], type: "dedupe_probe", title: "Once", dedupeKey: `probe:${stamp}` });
    expect(await stored(who.sECE.userId, "dedupe_probe")).toHaveLength(1);
  }, 60_000);

  it("a signed-out visitor gets 401", async () => {
    state.client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false }, realtime: { transport: class {} as never } });
    expect((await listNotifications(new Request("http://localhost/api/notifications"))).status).toBe(401);
  });
});
