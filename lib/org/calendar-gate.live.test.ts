import { createServerClient } from "@supabase/ssr";
import { afterAll, describe, expect, it } from "vitest";
import { getStudentDirection } from "@/lib/career/direction";
import { createThrowawayUser, createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { saveCalendarEntry } from "./academic-calendar";

/**
 * The college's semester start dates against the real database: what a student's Plan B (3-1) and Launchpad / AI Interview (4-1) flags do as the college
 * sets dates, and, when LIVE_BASE_URL points at a running app, who may set them (admin, HOD of the branch, other staff) through the real route.
 * Throwaway college and people, all deleted afterwards.
 */
const BASE = process.env.LIVE_BASE_URL;
const service = liveServiceClient();
const people: string[] = [];
let institutionId = "";
let admin = "";
let year3Cse = "";
let year4Cse = "";
let year3Ece = "";
const stamp = Date.now();

const person = async (label: string) => {
  const id = await createThrowawayUser(service, `cal-${label}`);
  people.push(id);
  return id;
};
const join = async (userId: string, role: string, branch: string | null, years: { start: number; end: number } | null = null) => {
  // the same two steps the project's other live tests use: staff roles are not inserted as active, they are activated afterwards
  const { data, error } = await service.from("institution_memberships").insert({
    user_id: userId, institution_id: institutionId, role: role as never, branch, ...(years ? { start_year: years.start, end_year: years.end } : {}),
  }).select("id").single();
  if (error) throw error;
  const { error: activateError } = await service.from("institution_memberships").update({ status: "active" }).eq("id", data!.id);
  if (activateError) throw activateError;
};
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

afterAll(async () => {
  for (const id of people) await deleteThrowawayUser(service, id);
  if (institutionId) {
    await service.from("academic_calendar" as never).delete().eq("institution_id", institutionId);
    await service.from("institution_memberships").delete().eq("institution_id", institutionId);
    await service.from("institutions").delete().eq("id", institutionId);
  }
});

describe("semester start dates drive the student's Plan B and Launchpad flags", () => {
  it("sets up a college with a 3rd-year and a final-year student in CSE and a 3rd-year student in ECE", async () => {
    const { data: inst, error } = await service.from("institutions").insert({ name: `ZZ CALENDAR ${stamp}`, slug: `zz-cal-${stamp}` }).select("id").single();
    if (error) throw error;
    institutionId = inst!.id;
    admin = await person("admin");
    await join(admin, "principal", null);
    // a 4-year programme 2024-2028 is in its 3rd year during 2026-27, and one 2023-2027 in its final year
    year3Cse = await person("y3cse");
    await join(year3Cse, "student", "CSE", { start: 2024, end: 2028 });
    year4Cse = await person("y4cse");
    await join(year4Cse, "student", "CSE", { start: 2023, end: 2027 });
    year3Ece = await person("y3ece");
    await join(year3Ece, "student", "ECE", { start: 2024, end: 2028 });

    const now = at("2026-08-10");
    expect((await getStudentDirection(service, year3Cse, now))?.academicYear?.year).toBe(3);
    expect((await getStudentDirection(service, year4Cse, now))?.academicYear?.year).toBe(4);
  });

  it("with no dates from the college, the year decides as it always did", async () => {
    const now = at("2026-08-10");
    expect(await getStudentDirection(service, year3Cse, now)).toMatchObject({ planBOpen: true, launchpadOpen: false, semesterFromCollege: false });
    expect(await getStudentDirection(service, year4Cse, now)).toMatchObject({ planBOpen: true, launchpadOpen: true });
  });

  it("a 3-1 date holds Plan B back until it arrives, for that branch only", async () => {
    await saveCalendarEntry(service, institutionId, admin, { branch: "CSE", yearOfStudy: 3, semester: 1, startsOn: "2026-09-01", endsOn: "2026-12-20" });
    expect(await getStudentDirection(service, year3Cse, at("2026-08-10"))).toMatchObject({ planBOpen: false, launchpadOpen: false });
    expect((await getStudentDirection(service, year3Cse, at("2026-08-31")))?.planBOpen).toBe(false);
    expect(await getStudentDirection(service, year3Cse, at("2026-09-01"))).toMatchObject({ planBOpen: true, semester: 1, semesterFromCollege: true });
    // ECE has no date of its own, and the CSE date is not theirs
    expect((await getStudentDirection(service, year3Ece, at("2026-08-10")))?.planBOpen).toBe(true);
    // the final-year CSE student is in year 4: a year-3 date does not touch them
    expect(await getStudentDirection(service, year4Cse, at("2026-08-10"))).toMatchObject({ planBOpen: true, launchpadOpen: true });
  });

  it("a 4-1 date holds Launchpad and the AI Interview back until it arrives", async () => {
    await saveCalendarEntry(service, institutionId, admin, { branch: "CSE", yearOfStudy: 4, semester: 1, startsOn: "2026-09-15", endsOn: "2027-01-10" });
    expect(await getStudentDirection(service, year4Cse, at("2026-09-14"))).toMatchObject({ launchpadOpen: false, planBOpen: true });
    expect((await getStudentDirection(service, year4Cse, at("2026-09-15")))?.launchpadOpen).toBe(true);
  });

  it("a college-wide date applies to every branch, and a branch's own date overrides it", async () => {
    await saveCalendarEntry(service, institutionId, admin, { branch: "*", yearOfStudy: 3, semester: 1, startsOn: "2026-10-01", endsOn: "2027-02-01" });
    expect((await getStudentDirection(service, year3Ece, at("2026-09-20")))?.planBOpen).toBe(false);
    expect((await getStudentDirection(service, year3Ece, at("2026-10-01")))?.planBOpen).toBe(true);
    // CSE's own 3-1 date (Sept 1) still wins over the college-wide Oct 1
    expect((await getStudentDirection(service, year3Cse, at("2026-09-02")))?.planBOpen).toBe(true);
  });

  it("changing the date changes what the student gets, and a date a year early holds nothing back", async () => {
    await saveCalendarEntry(service, institutionId, admin, { branch: "CSE", yearOfStudy: 3, semester: 1, startsOn: "2026-09-20", endsOn: "2027-01-10" });
    expect((await getStudentDirection(service, year3Cse, at("2026-09-10")))?.planBOpen).toBe(false);
    await saveCalendarEntry(service, institutionId, admin, { branch: "CSE", yearOfStudy: 3, semester: 1, startsOn: "2027-07-01", endsOn: "2027-12-20" });
    expect((await getStudentDirection(service, year3Cse, at("2026-09-10")))?.planBOpen).toBe(true);
  });
});

describe.skipIf(!BASE)("who may set the dates, through the running app", () => {
  /** A signed-in browser for one of the college's people. */
  async function browser(userId: string) {
    const { data: user } = await service.auth.admin.getUserById(userId);
    const password = crypto.randomUUID();
    await service.auth.admin.updateUserById(userId, { password });
    const jar = new Map<string, string>();
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (all) => all.forEach(({ name, value }) => jar.set(name, value)) },
    });
    const { error } = await client.auth.signInWithPassword({ email: user.user!.email!, password });
    if (error) throw error;
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    return async (method: "GET" | "POST", path: string, body?: unknown) => {
      const res = await fetch(`${BASE}${path}`, { method, headers: { cookie, "content-type": "application/json", origin: BASE! }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
      const text = await res.text();
      let json: Record<string, unknown> | null = null;
      try { json = JSON.parse(text); } catch { /* a page, not JSON */ }
      return { status: res.status, json, text };
    };
  }
  const entry = (branch: string, over: Record<string, unknown> = {}) => ({ branch, yearOfStudy: 2, semester: 1, startsOn: "2027-07-01", endsOn: "2027-12-15", ...over });

  it("an admin sets any branch and the college-wide date; an HOD only their own branch; other staff, none", async () => {
    const hod = await person("hod");
    await join(hod, "hod", "CSE");
    const hodNoBranch = await person("hod-nobranch");
    await join(hodNoBranch, "hod", null);
    const faculty = await person("faculty");
    await join(faculty, "faculty", "CSE");
    const tpo = await person("tpo");
    await join(tpo, "tpo", null);

    const asAdmin = await browser(admin);
    expect((await asAdmin("POST", "/api/org/calendar", entry("ECE"))).status).toBe(200);
    expect((await asAdmin("POST", "/api/org/calendar", entry("*", { yearOfStudy: 0 }))).status).toBe(200);

    const asHod = await browser(hod);
    expect((await asHod("POST", "/api/org/calendar", entry("CSE"))).status).toBe(200);
    expect((await asHod("POST", "/api/org/calendar", entry(" cse "))).status).toBe(200);
    const other = await asHod("POST", "/api/org/calendar", entry("ECE"));
    expect(other.status).toBe(403);
    expect(String(other.json?.error)).toMatch(/only set dates for CSE/);
    expect((await asHod("POST", "/api/org/calendar", entry("*", { yearOfStudy: 0 }))).status).toBe(403);

    expect((await (await browser(hodNoBranch))("POST", "/api/org/calendar", entry("CSE"))).status).toBe(403);
    expect((await (await browser(faculty))("POST", "/api/org/calendar", entry("CSE"))).status).toBe(403);
    expect((await (await browser(tpo))("POST", "/api/org/calendar", entry("CSE"))).status).toBe(403);
    expect((await (await browser(year3Cse))("POST", "/api/org/calendar", entry("CSE"))).status).toBe(403);
    expect((await fetch(`${BASE}/api/org/calendar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry("CSE")), redirect: "manual" })).status).toBeGreaterThanOrEqual(300);

    // the HOD's dates really landed, in their own college and branch
    const { data: rows } = await service.from("academic_calendar" as never).select("branch_key, institution_id, updated_by").eq("institution_id", institutionId);
    expect((rows as { branch_key: string; updated_by: string }[]).some((r) => r.branch_key === "cse" && r.updated_by === hod)).toBe(true);

    // the page: the HOD gets it, faculty and students do not
    const page = await asHod("GET", "/org/calendar");
    expect(page.status).toBe(200);
    expect(page.text).toContain("What these dates control for students");
    expect([404, 307, 308]).toContain((await (await browser(faculty))("GET", "/org/calendar")).status);
  }, 600_000);

});
