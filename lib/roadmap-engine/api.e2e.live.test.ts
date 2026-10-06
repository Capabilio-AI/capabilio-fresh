import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { saveCareerIntent } from "@/lib/careers/intent";
import { loadCareers } from "@/lib/careers/data";

// Real HTTP against the running dev server (E2E_BASE_URL, default http://localhost:3000) with real session cookies. Real AI explanations
// are NOT stubbed here, so this also proves a model outage or a slow model cannot break the response.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const service = liveServiceClient();
const stamp = Date.now();
const BRANCH = "ZZ Api Branch";
type U = { userId: string; email: string; password: string };
let s: U, other: U;
let cookie = "", otherCookie = "";
let inst = "";

async function login(u: U) {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await client.auth.signInWithPassword(u);
  if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const call = (c: string, method: string, path: string, body?: unknown) => fetch(`${BASE}${path}`, { method, headers: { ...(c ? { cookie: c } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });

beforeAll(async () => {
  inst = (await service.from("institutions").insert({ name: `ZZ API ${stamp}`, slug: `zz-api-${stamp}` }).select("id").single()).data!.id;
  [s, other] = await Promise.all([createThrowawayUserWithLogin(service, "api-s"), createThrowawayUserWithLogin(service, "api-o")]);
  const thisYear = new Date().getFullYear();
  await service.from("institution_memberships").insert({ user_id: s.userId, institution_id: inst, role: "student", status: "active", branch: BRANCH, start_year: thisYear - 2, end_year: thisYear + 2, year_confirmed_at: new Date().toISOString(), year_override: 3 });
  const { data: skills } = await service.from("skills").select("id, key").eq("status", "active");
  const sql = (skills ?? []).find((x) => x.key === "SKILL_SQL")!.id;
  const { data: imp } = await service.from("curriculum_imports").insert({ institution_id: inst, branch: BRANCH, status: "CONFIRMED" }).select("id").single();
  const { data: course } = await service.from("courses").insert({ import_id: imp!.id, year: 3, semester: 1, title: "Database Management Systems" }).select("id").single();
  await service.from("course_skill_mappings").insert({ course_id: course!.id, skill_id: sql, importance: "CORE", mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString() });
  await service.rpc("publish_curriculum_import", { p_import_id: imp!.id, p_user_id: null as unknown as string });
  [cookie, otherCookie] = await Promise.all([login(s), login(other)]);
}, 120_000);

afterAll(async () => {
  await service.from("institution_memberships").delete().eq("institution_id", inst);
  await service.from("institutions").delete().eq("id", inst);
  await Promise.all([s, other].map((u) => deleteThrowawayUser(service, u.userId)));
});

describe("student roadmap API over real HTTP", () => {
  it("requires a signed-in student", async () => {
    for (const [m, p] of [["GET", "/api/roadmap"], ["POST", "/api/roadmap/refresh"], ["GET", "/api/roadmap/versions"], ["GET", `/api/roadmap/versions/${crypto.randomUUID()}`]] as const) {
      expect((await call("", m, p)).status, `${m} ${p}`).toBe(401);
    }
  });

  it("with no career goal it says so precisely and writes nothing", async () => {
    const r = await call(cookie, "GET", "/api/roadmap");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "MISSING_CAREER_GOAL" });
    expect(((await (await call(cookie, "GET", "/api/roadmap/versions")).json()) as { versions: unknown[] }).versions).toEqual([]);
  });

  it("with a goal it builds the roadmap; asking again is a no-op; refresh reports 'up to date'", async () => {
    const careers = Object.fromEntries((await loadCareers(service)).map((c) => [c.key, c.id]));
    await saveCareerIntent(service, s.userId, { primaryCareerId: careers["data-analyst"] });
    const first = await (await call(cookie, "GET", "/api/roadmap")).json();
    expect(first).toMatchObject({ status: "READY", created: true, trigger: "CAREER_CHANGE", roadmap: { versionNo: 1, career: { name: "Data Analyst" }, baselineRecommended: true } });
    expect(first.roadmap.gaps.length).toBeGreaterThan(5);
    expect(first.roadmap.nextBestAction.kind).toBe("ASSESS"); // no capability data yet: honest first step
    expect(first.roadmap.notes.mandatoryNote).toMatch(/remain part of your academic curriculum/);
    const again = await (await call(cookie, "GET", "/api/roadmap")).json();
    expect(again).toMatchObject({ created: false, roadmap: { versionNo: 1, versionId: first.roadmap.versionId } });
    const refresh = await (await call(cookie, "POST", "/api/roadmap/refresh")).json();
    expect(refresh).toMatchObject({ status: "READY", created: false, upToDate: true });
  });

  it("history lists every version, and one can be opened by its owner only", async () => {
    await service.from("capabilities").insert({ user_id: s.userId, skill: "SQL", domain: "Data", capability_score: 50, confidence: "medium", data_points: 3 });
    const second = await (await call(cookie, "POST", "/api/roadmap/refresh")).json();
    expect(second).toMatchObject({ created: true, trigger: "MANUAL", roadmap: { versionNo: 2, baselineRecommended: false } });
    const { versions } = (await (await call(cookie, "GET", "/api/roadmap/versions")).json()) as { versions: { versionId: string; versionNo: number }[] };
    expect(versions.map((v) => v.versionNo)).toEqual([2, 1]);
    const v1 = versions[1].versionId;
    const own = await call(cookie, "GET", `/api/roadmap/versions/${v1}`);
    expect(own.status).toBe(200);
    expect(((await own.json()) as { roadmap: { versionNo: number; isLatest: boolean } }).roadmap).toMatchObject({ versionNo: 1, isLatest: false });
    expect((await call(otherCookie, "GET", `/api/roadmap/versions/${v1}`)).status).toBe(404); // someone else's version
    expect((await call(cookie, "GET", "/api/roadmap/versions/not-a-uuid")).status).toBe(400);
  });

  it("another student sees only their own state, never this student's roadmap", async () => {
    expect(await (await call(otherCookie, "GET", "/api/roadmap")).json()).toEqual({ status: "MISSING_ACADEMIC_POSITION", reason: "no_membership" });
    expect(((await (await call(otherCookie, "GET", "/api/roadmap/versions")).json()) as { versions: unknown[] }).versions).toEqual([]);
  });
});
