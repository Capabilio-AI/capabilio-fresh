import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { addCourses, createImport, saveCourse } from "./writes";

// Real HTTP against the running dev server (E2E_BASE_URL, default http://localhost:3000): real session cookies, real routes, real pages.
// This renders the pages on the server and drives the API; it does NOT execute client-side React in a browser.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const service = liveServiceClient();
const stamp = Date.now();
const BRANCH = `ZZ Wizard Branch ${stamp}`;
type U = { userId: string; email: string; password: string };
let adminA: U, adminB: U, student: U;
let cookieA = "", cookieB = "", cookieS = "";
let instA = "", instB = "";
let importId = "", dbmsId = "", statsId = "";
let sqlId = "", dbmsSkill = "", statsSkill = "";

async function login(u: { email: string; password: string }) {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await client.auth.signInWithPassword(u);
  if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function member(u: U, institutionId: string, role: "principal" | "student") {
  await service.from("institution_memberships").insert({ user_id: u.userId, institution_id: institutionId, role, ...(role === "student" ? { branch: "ZZ" } : {}) });
  if (role !== "student") await service.from("institution_memberships").update({ status: "active" }).eq("user_id", u.userId).eq("institution_id", institutionId);
}
const page = (cookie: string, path: string) => fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
const call = (cookie: string, method: string, path: string, body?: unknown) => fetch(`${BASE}${path}`, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const text = async (r: Response) => (await r.text()).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

beforeAll(async () => {
  [adminA, adminB, student] = await Promise.all(["a", "b", "s"].map((l) => createThrowawayUserWithLogin(service, `wz-${l}`)));
  const mk = async (l: string) => (await service.from("institutions").insert({ name: `ZZ WIZARD ${l} ${stamp}`, slug: `zz-wz-${l.toLowerCase()}-${stamp}` }).select("id").single()).data!.id;
  [instA, instB] = await Promise.all([mk("A"), mk("B")]);
  await Promise.all([member(adminA, instA, "principal"), member(adminB, instB, "principal"), member(student, instA, "student")]);
  [cookieA, cookieB, cookieS] = await Promise.all([login(adminA), login(adminB), login(student)]);

  const admin = { userId: adminA.userId, institutionId: instA };
  const created = await createImport(service, admin, { branch: BRANCH, regulation: "ZZ-W1" });
  if (!created.ok) throw new Error(created.message);
  importId = created.id;
  await addCourses(service, admin, importId, [{ year: 2, semester: 2, title: "Database Management Systems" }, { year: 2, semester: 1, title: "Probability and Statistics" }]);
  const ids = await service.from("courses").select("id, title").eq("import_id", importId);
  dbmsId = ids.data!.find((c) => /Database/.test(c.title))!.id;
  statsId = ids.data!.find((c) => /Probability/.test(c.title))!.id;
  await saveCourse(service, admin, dbmsId, { outcomes: [{ code: "CO1", text: "Write SQL queries for data retrieval", bloomLevel: "Apply" }], units: [{ unitNo: 1, title: "Relational model", topics: ["Keys", "Joins"] }], objectives: ["Learn relational databases"] });
  const { data: skills } = await service.from("skills").select("id, key").in("key", ["SKILL_SQL", "SKILL_DBMS", "SKILL_STATISTICS"]);
  const sk = (k: string) => skills!.find((s) => s.key === k)!.id;
  [sqlId, dbmsSkill, statsSkill] = [sk("SKILL_SQL"), sk("SKILL_DBMS"), sk("SKILL_STATISTICS")];
  // DBMS: SQL confirmed, DBMS suggested (0.9), Statistics suggested (0.5)
  await service.from("course_skill_mappings").insert([
    { course_id: dbmsId, skill_id: sqlId, mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString() },
    { course_id: dbmsId, skill_id: dbmsSkill, mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence: 0.9, evidence_source: "Learn relational databases" },
    { course_id: dbmsId, skill_id: statsSkill, mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence: 0.5 },
  ]);
}, 120_000);

afterAll(async () => {
  await service.from("institution_memberships").delete().in("institution_id", [instA, instB]);
  await service.from("institutions").delete().in("id", [instA, instB]);
  await Promise.all([adminA, adminB, student].map((u) => deleteThrowawayUser(service, u.userId)));
});

describe("curriculum wizard over HTTP (real session, real routes, server-rendered pages)", () => {
  it("lists the college's curricula; only its own", async () => {
    const r = await page(cookieA, "/org/curriculum");
    expect(r.status).toBe(200);
    const html = await text(r);
    expect(html).toContain(BRANCH);
    expect(html).toContain("ZZ-W1");
    expect(await text(await page(cookieB, "/org/curriculum"))).not.toContain(BRANCH);
  }, 180_000);

  it("renders every wizard step", async () => {
    const expected: Record<string, string> = {
      upload: "started by hand", structure: "Program, branch and regulation", courses: "Add courses", outcomes: "have learning outcomes",
      mappings: "Suggest skills", relevance: "configured yet", confirm: "Before you confirm", publish: "Confirm the curriculum first",
    };
    for (const [step, marker] of Object.entries(expected)) {
      const r = await page(cookieA, `/org/curriculum/${importId}?step=${step}`);
      expect(r.status, step).toBe(200);
      const html = await text(r);
      expect(html, step).toContain(marker);
      expect(html, step).toContain("Courses"); // summary card
      expect(html, step).toContain(BRANCH);
    }
    expect(await text(await page(cookieA, `/org/curriculum/${importId}?step=../../x`))).toContain("started by hand"); // unknown step falls back to the first
  }, 240_000);

  it("the course page shows exactly the mappings that are stored — counts and chips agree (the 'Mapped to 2' bug)", async () => {
    const r = await page(cookieA, `/org/curriculum/${importId}/courses/${dbmsId}`);
    expect(r.status).toBe(200);
    const html = await text(r);
    expect(html).toContain("1 confirmed · 2 suggested · 0 rejected");
    for (const name of ["SQL", "Database Management Systems", "Statistics"]) expect(html).toContain(name);
    expect(html).toContain("Suggested — needs review");
    expect(html).toContain("Write SQL queries for data retrieval"); // the outcome
    expect(html).toContain("Relational model"); // the unit
    expect(html).toContain("Career requirements aren't configured yet");
    // a course with no mappings says so rather than showing a stale count
    expect(await text(await page(cookieA, `/org/curriculum/${importId}/courses/${statsId}`))).toContain("No skills yet");
  }, 180_000);

  it("other institutions and non-admins get nothing", async () => {
    for (const path of [`/org/curriculum/${importId}`, `/org/curriculum/${importId}/courses/${dbmsId}`]) {
      expect((await page(cookieB, path)).status, `B ${path}`).toBe(404);
    }
    expect((await page(cookieS, "/org/curriculum")).status).not.toBe(200); // a student is not staff
    expect((await page("", "/org/curriculum")).status).not.toBe(200);
    for (const [m, p, b] of [["PATCH", `/api/admin/curriculum/imports/${importId}`, { regulation: "x" }], ["PUT", `/api/admin/curriculum/courses/${dbmsId}`, { title: "x" }], ["PUT", `/api/admin/curriculum/courses/${dbmsId}/mappings`, { decisions: [{ skillId: sqlId, decision: "reject" }] }], ["POST", `/api/admin/curriculum/imports/${importId}/publish`, undefined]] as const) {
      expect((await call(cookieB, m, p, b)).status, `B ${m} ${p}`).toBe(404);
      expect([401, 403], `student ${m} ${p}`).toContain((await call(cookieS, m, p, b)).status);
      expect([401, 403], `anon ${m} ${p}`).toContain((await call("", m, p, b)).status);
    }
  }, 180_000);

  it("drives the real routes through edit → decide → confirm → publish → frozen", async () => {
    // validation: unknown fields and PUBLISHED-by-status are refused
    expect((await call(cookieA, "PATCH", `/api/admin/curriculum/imports/${importId}`, { status: "PUBLISHED" })).status).toBe(400);
    expect((await call(cookieA, "PUT", `/api/admin/curriculum/courses/${dbmsId}`, { title: "x", institutionId: instB })).status).toBe(400);
    // edit the course tree
    const put = await call(cookieA, "PUT", `/api/admin/curriculum/courses/${dbmsId}`, { credits: 3, outcomes: [{ code: "CO1", text: "Write SQL queries for data retrieval" }, { code: "CO2", text: "Normalise a schema to 3NF" }] });
    expect(put.status).toBe(200);
    // decisions: confirm the suggested DBMS skill, reject Statistics
    const dec = await call(cookieA, "PUT", `/api/admin/curriculum/courses/${dbmsId}/mappings`, { decisions: [{ skillId: dbmsSkill, decision: "confirm", importance: "CORE" }, { skillId: statsSkill, decision: "reject" }] });
    expect(dec.status).toBe(200);
    expect(await dec.json()).toMatchObject({ confirmed: 1, rejected: 1 });
    const html = await text(await page(cookieA, `/org/curriculum/${importId}/courses/${dbmsId}`));
    expect(html).toContain("2 confirmed · 0 suggested · 1 rejected");
    // confirm → publish
    expect((await call(cookieA, "POST", `/api/admin/curriculum/imports/${importId}/publish`)).status).toBe(409); // not confirmed yet
    expect((await call(cookieA, "PATCH", `/api/admin/curriculum/imports/${importId}`, { status: "CONFIRMED" })).status).toBe(200);
    const pub = await call(cookieA, "POST", `/api/admin/curriculum/imports/${importId}/publish`);
    expect(pub.status).toBe(200);
    expect(await pub.json()).toMatchObject({ ok: true });
    const { data: v } = await service.from("curriculum_versions").select("version_no, published_by").eq("import_id", importId).single();
    expect(v).toEqual({ version_no: 1, published_by: adminA.userId });
    // frozen, with a clear message
    const frozen = await call(cookieA, "PUT", `/api/admin/curriculum/courses/${dbmsId}`, { title: "Changed" });
    expect(frozen.status).toBe(409);
    expect((await frozen.json()).error).toMatch(/published/);
    expect((await call(cookieA, "DELETE", `/api/admin/curriculum/imports/${importId}`)).status).toBe(409);
    const publishedPage = await text(await page(cookieA, `/org/curriculum/${importId}?step=publish`));
    expect(publishedPage).toContain("Version 1 is live");
    expect(await text(await page(cookieA, `/org/curriculum/${importId}/courses/${dbmsId}`))).toContain("This curriculum is published, so it can't be edited");

    // a correction is made on a copy
    expect((await call(cookieB, "POST", `/api/admin/curriculum/imports/${importId}/new-version`)).status).toBe(404);
    const nv = await call(cookieA, "POST", `/api/admin/curriculum/imports/${importId}/new-version`);
    expect(nv.status).toBe(201);
    const newId = (await nv.json()).id as string;
    expect((await call(cookieA, "POST", `/api/admin/curriculum/imports/${importId}/new-version`)).status).toBe(409); // one in progress at a time
    const draft = await text(await page(cookieA, `/org/curriculum/${newId}?step=courses`));
    expect(draft).toContain("Database Management Systems");
    expect(draft).toContain("Add courses");
    const list = await text(await page(cookieA, "/org/curriculum"));
    expect(list).toContain("Continue review");
    expect(list).toContain("Create a new version"); // not offered once one is in progress? it is still listed for the published row
    expect((await call(cookieA, "PATCH", `/api/admin/curriculum/imports/${newId}`, { status: "CONFIRMED" })).status).toBe(200);
    expect((await call(cookieA, "POST", `/api/admin/curriculum/imports/${newId}/publish`)).status).toBe(200);
    expect((await service.from("curriculum_imports").select("status").eq("id", importId).single()).data!.status).toBe("ARCHIVED");
  }, 300_000);
});
