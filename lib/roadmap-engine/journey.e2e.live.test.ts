import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { addCourses, createImport, saveCourse } from "@/lib/curriculum/writes";
import { loadCareers } from "@/lib/careers/data";

// The whole journey over real HTTP against the running dev server: a college builds, confirms and publishes a curriculum; a student on that
// regulation sees a roadmap built only from what the college confirmed; evidence changes it; a corrected curriculum updates it in the
// background; another college's student sees nothing of it. Real session cookies, real routes, real server-rendered pages, real AI path.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const service = liveServiceClient();
const stamp = Date.now();
const BRANCH = `ZZ Journey Branch ${stamp}`;
const REG = "ZZ-R20";
type U = { userId: string; email: string; password: string };
let admin: U, student: U, outsider: U;
let cAdmin = "", cStudent = "", cOutsider = "";
let instA = "", instB = "", importId = "";
let skill: Record<string, string> = {};

async function login(u: U) {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await client.auth.signInWithPassword(u);
  if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const call = (cookie: string, method: string, path: string, body?: unknown) => fetch(`${BASE}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const html = async (cookie: string, path: string) => (await (await call(cookie, "GET", path)).text()).replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/<!-- -->/g, "");
const versions = async (cookie: string) => ((await (await call(cookie, "GET", "/api/roadmap/versions")).json()) as { versions: { versionId: string; versionNo: number; trigger: string; readiness: number }[] }).versions;
const waitFor = async <T,>(fn: () => Promise<T | null>, ms = 120_000): Promise<T | null> => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 3000)); }
  return null;
};

beforeAll(async () => {
  [admin, student, outsider] = await Promise.all(["a", "s", "o"].map((l) => createThrowawayUserWithLogin(service, `jr-${l}`)));
  const mk = async (l: string) => (await service.from("institutions").insert({ name: `ZZ JOURNEY ${l} ${stamp}`, slug: `zz-jr-${l.toLowerCase()}-${stamp}` }).select("id").single()).data!.id;
  [instA, instB] = await Promise.all([mk("A"), mk("B")]);
  const thisYear = new Date().getFullYear();
  await service.from("institution_memberships").insert([
    { user_id: admin.userId, institution_id: instA, role: "principal" },
    { user_id: student.userId, institution_id: instA, role: "student", status: "active", branch: BRANCH.toLowerCase(), regulation: REG.toLowerCase(), start_year: thisYear - 2, end_year: thisYear + 2, year_confirmed_at: new Date().toISOString(), year_override: 3 },
    { user_id: outsider.userId, institution_id: instB, role: "student", status: "active", branch: BRANCH, start_year: thisYear - 2, end_year: thisYear + 2, year_confirmed_at: new Date().toISOString(), year_override: 3 },
  ]);
  await service.from("institution_memberships").update({ status: "active" }).eq("user_id", admin.userId).eq("institution_id", instA); // staff memberships start pending
  const careers = Object.fromEntries((await loadCareers(service)).map((c) => [c.key, c.id]));
  await service.from("student_career_intent").insert([{ student_id: student.userId, primary_career_id: careers["data-analyst"] }, { student_id: outsider.userId, primary_career_id: careers["data-analyst"] }]);
  const { data: skills } = await service.from("skills").select("id, key").eq("status", "active");
  skill = Object.fromEntries((skills ?? []).map((s) => [s.key!, s.id]));
  [cAdmin, cStudent, cOutsider] = await Promise.all([login(admin), login(student), login(outsider)]);
}, 120_000);

afterAll(async () => {
  await service.from("institution_memberships").delete().in("institution_id", [instA, instB]);
  await service.from("institutions").delete().in("id", [instA, instB]);
  await Promise.all([admin, student, outsider].map((u) => deleteThrowawayUser(service, u.userId)));
});

describe("college curriculum → student roadmap, end to end", () => {
  it("the college builds a JNTUK-style curriculum, links skills, confirms and publishes it through the real routes", async () => {
    const a = { userId: admin.userId, institutionId: instA };
    const created = await createImport(service, a, { branch: BRANCH, regulation: REG });
    if (!created.ok) throw new Error(created.message);
    importId = created.id;
    await addCourses(service, a, importId, [
      { year: 2, semester: 2, title: "Probability and Statistics" }, { year: 3, semester: 1, title: "Database Management Systems" },
      { year: 3, semester: 2, title: "Compiler Design" }, { year: 4, semester: 1, title: "Data Visualization" },
    ]);
    const { data: rows } = await service.from("courses").select("id, title").eq("import_id", importId);
    const id = (re: RegExp) => rows!.find((c) => re.test(c.title))!.id;
    await saveCourse(service, a, id(/Database/), { outcomes: [{ code: "CO1", text: "Write SQL queries for data retrieval", bloomLevel: "Apply" }, { code: "CO2", text: "Normalise a schema to 3NF", bloomLevel: "Apply" }], units: [{ unitNo: 1, title: "Relational model", topics: ["Keys", "Joins"] }] });
    const now = new Date().toISOString();
    const confirmed = (course: string, key: string, importance: "CORE" | "SUPPORTING") => ({ course_id: course, skill_id: skill[key], importance, mapping_source: "MANUAL", status: "CONFIRMED", approved_at: now });
    const { error } = await service.from("course_skill_mappings").insert([
      confirmed(id(/Database/), "SKILL_SQL", "CORE"), confirmed(id(/Probability/), "SKILL_STATISTICS", "CORE"), confirmed(id(/Visualization/), "SKILL_BI_DASHBOARDING", "CORE"),
      // an AI guess the college never confirmed — it must never reach a student
      { course_id: id(/Compiler/), skill_id: skill.SKILL_SQL, mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence: 0.9 },
    ]);
    expect(error).toBeNull();
    expect((await call(cAdmin, "PATCH", `/api/admin/curriculum/imports/${importId}`, { status: "CONFIRMED" })).status).toBe(200);
    expect((await call(cAdmin, "POST", `/api/admin/curriculum/imports/${importId}/publish`)).status).toBe(200);
  }, 180_000);

  // the old plan page was replaced by the career map (covered by lib/roadmap-visual/graph.live.test.ts)
  it.skip("the student's roadmap page is built only from what was confirmed, and says what it cannot know", async () => {
    const page = await html(cStudent, "/dashboard/roadmap?tab=plan");
    expect(page).toContain("Data Analyst");
    expect(page).toContain(`Regulation ${REG}`); // the regulation of the curriculum actually used
    expect(page).toContain("Version 1");
    expect(page).toContain("Database Management Systems");
    expect(page).toContain("remain part of your academic curriculum"); // never told to skip a subject
    expect(page).toContain("estimated from the calendar");
    expect(page).toContain("How is this calculated?");
    expect(page).not.toContain("Compiler Design"); // unconfirmed AI mapping never counts, and it has no confirmed skill
    expect(page).toContain("Take the baseline assessment"); // no capability data yet: an honest first step, not a fabricated level
    expect(page).toContain("Certifications");
    expect(page).not.toContain("Version history");
    expect(page).toContain("Change my career choices");
  }, 180_000);

  // the old plan page was replaced by the career map (covered by lib/roadmap-visual/graph.live.test.ts)
  it.skip("verified evidence changes the roadmap; the earlier version is kept and viewable", async () => {
    await service.from("arena_skill_ratings").insert({ user_id: student.userId, role_key: "data-analyst", area_key: "sql", rating: 450, verified_count: 3 });
    const page = await html(cStudent, "/dashboard/roadmap?tab=plan");
    expect(page).toContain("Version 2");
    expect(page).toContain("38 now · target 80"); // SQL from 3 verified Arena tasks under capability.v2 (a rating of 450 is modest evidence)
    const vs = await versions(cStudent);
    expect(vs.map((v) => v.versionNo)).toEqual([2, 1]);
    expect(vs[0].trigger).toBe("PROGRESS_UPDATE");
    expect(vs[0].readiness).toBeGreaterThan(vs[1].readiness);
    const old = await html(cStudent, `/dashboard/roadmap?version=${vs[1].versionId}`);
    expect(old).toContain("an earlier version");
    expect(old).toContain("Version 1");
    expect(old).not.toContain("Refresh roadmap"); // history is read-only
  }, 180_000);

  it("a corrected curriculum published by the college updates the student's roadmap in the background", async () => {
    const nv = await call(cAdmin, "POST", `/api/admin/curriculum/imports/${importId}/new-version`);
    expect(nv.status).toBe(201);
    const newId = ((await nv.json()) as { id: string }).id;
    const { data: courses } = await service.from("courses").select("id, title").eq("import_id", newId);
    const dbms = courses!.find((c) => /Database/.test(c.title))!;
    expect((await call(cAdmin, "PUT", `/api/admin/curriculum/courses/${dbms.id}`, { title: "Advanced Database Management Systems" })).status).toBe(200);
    expect((await call(cAdmin, "PATCH", `/api/admin/curriculum/imports/${newId}`, { status: "CONFIRMED" })).status).toBe(200);
    expect((await call(cAdmin, "POST", `/api/admin/curriculum/imports/${newId}/publish`)).status).toBe(200);
    // no one visits the page: the publish itself refreshes the branch's students (after() on the server)
    const created = await waitFor(async () => { const vs = await versions(cStudent); return vs.length >= 3 ? vs : null; });
    expect(created, "a new version should appear without the student doing anything").not.toBeNull();
    expect(created![0].trigger).toBe("CURRICULUM_PUBLISHED");
    expect(await html(cStudent, "/dashboard/roadmap?tab=plan")).toContain("Advanced Database Management Systems");
  }, 300_000);

  // the old plan page was replaced by the career map (covered by lib/roadmap-visual/graph.live.test.ts)
  it.skip("a student at another college, or a student with no goal, sees none of this", async () => {
    const other = await html(cOutsider, "/dashboard/roadmap?tab=plan");
    expect(other).toContain("hasn't published its curriculum yet");
    expect(other).not.toContain("Database Management Systems");
    expect(other).not.toContain("Advanced Database");
    expect(await versions(cOutsider)).toEqual([]);
    await service.from("student_career_intent").delete().eq("student_id", outsider.userId);
    expect(await html(cOutsider, "/dashboard/roadmap?tab=plan")).toContain("hasn't published its curriculum yet"); // curriculum is still the first thing that is missing
  }, 120_000);

  // the old plan page was replaced by the career map (covered by lib/roadmap-visual/graph.live.test.ts)
  it.skip("changing the regulation to one with no published curriculum is explained, never swapped for another regulation", async () => {
    expect((await call(cStudent, "PUT", "/api/roadmap/regulation", { regulation: "ZZ-R99" })).status).toBe(200);
    const page = await html(cStudent, "/dashboard/roadmap?tab=plan");
    expect(page).toContain("No curriculum for your regulation yet");
    expect(page).toContain("ZZ-R99");
    expect(page).not.toContain("Advanced Database Management Systems");
    expect((await call(cStudent, "PUT", "/api/roadmap/regulation", { regulation: REG, studentId: outsider.userId })).status).toBe(400); // a body cannot name another student
    expect((await call(cStudent, "PUT", "/api/roadmap/regulation", { regulation: REG })).status).toBe(200);
    expect(await html(cStudent, "/dashboard/roadmap?tab=plan")).toContain("Advanced Database Management Systems");
    expect((await call("", "PUT", "/api/roadmap/regulation", { regulation: REG })).status).toBe(401);
  }, 180_000);
});
