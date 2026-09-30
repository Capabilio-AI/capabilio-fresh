import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { listEnabledRoles } from "@/lib/arena-workstations/taxonomy";
import { untyped } from "@/lib/org/db";
import type { ExtractionRecord } from "./types";

// Real HTTP against a running dev server (E2E_BASE_URL, default http://localhost:3000): real session cookies, real PDF, real AI.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const service = liveServiceClient();
const FIXTURE = readFileSync("docs/fixtures/jntuk-r23-btech-cse.pdf");
const stamp = Date.now();
let instA = "", instB = "", roleKey = "";
let adminA: { userId: string; email: string; password: string }, adminB: typeof adminA;
let cookieA = "", cookieB = "";

async function login(u: { email: string; password: string }) {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error } = await client.auth.signInWithPassword(u);
  if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function institution(label: string, u: { userId: string }) {
  const { data } = await service.from("institutions").insert({ name: `ZZ E2E ${label} ${stamp}`, slug: `zz-e2e-${label.toLowerCase()}-${stamp}` }).select("id").single();
  await service.from("institution_memberships").insert({ user_id: u.userId, institution_id: data!.id, role: "principal" });
  await service.from("institution_memberships").update({ status: "active" }).eq("user_id", u.userId).eq("institution_id", data!.id);
  return data!.id as string;
}
const upload = (cookie: string, file: Blob, name: string) => {
  const form = new FormData();
  form.set("file", file, name);
  form.set("branch", "ZZ Computer Science");
  form.set("roleKey", roleKey);
  return fetch(`${BASE}/api/admin/curriculum/extractions`, { method: "POST", headers: { cookie }, body: form });
};
const get = (cookie: string, id: string) => fetch(`${BASE}/api/admin/curriculum/extractions/${id}`, { headers: { cookie } });
const count = async (inst: string) => (await service.from("curriculum_subjects").select("id", { count: "exact", head: true }).eq("institution_id", inst)).count ?? 0;

describe("syllabus extraction over HTTP (real session, real PDF, real AI)", () => {
  beforeAll(async () => {
    [adminA, adminB] = await Promise.all(["a", "b"].map((l) => createThrowawayUserWithLogin(service, `e2e-${l}`)));
    [instA, instB] = await Promise.all([institution("A", adminA), institution("B", adminB)]);
    [cookieA, cookieB] = await Promise.all([login(adminA), login(adminB)]);
    roleKey = (await listEnabledRoles(service))[0].role_key;
  }, 60_000);
  afterAll(async () => {
    await untyped(service).from("curriculum_extractions").delete().in("institution_id", [instA, instB]);
    await service.from("curriculum_subjects").delete().in("institution_id", [instA, instB]);
    await service.from("institution_memberships").delete().in("institution_id", [instA, instB]);
    await service.from("institutions").delete().in("id", [instA, instB]);
    await Promise.all([adminA, adminB].map((u) => deleteThrowawayUser(service, u.userId)));
  });

  it("rejects a non-PDF and an unauthenticated caller, storing nothing", async () => {
    expect((await upload(cookieA, new Blob(["<html>hi</html>"], { type: "application/pdf" }), "fake.pdf")).status).toBe(415);
    expect((await upload("", new Blob([FIXTURE]), "x.pdf")).status).toBe(401);
    expect(await untyped(service).from("curriculum_extractions").select("id", { count: "exact", head: true }).eq("institution_id", instA).then((r) => r.count)).toBe(0);
  });

  it("the curriculum page renders all three input methods for an admin and 404s for a stranger", async () => {
    const page = await fetch(`${BASE}/org/curriculum`, { headers: { cookie: cookieA }, redirect: "manual" });
    expect(page.status).toBe(200);
    const html = await page.text();
    for (const heading of ["Add subjects", "Import from a template", "Extract from a syllabus PDF", "Read syllabus"]) expect(html).toContain(heading);
    expect(html).toContain("/org/curriculum/template");
    expect((await fetch(`${BASE}/org/curriculum`, { redirect: "manual" })).status).toBe(307); // signed out → login
  }, 60_000);

  it("upload → 202 at once → processing → ready; nothing is written until confirm; confirm reuses the existing routes", async () => {
    const t0 = Date.now();
    const res = await upload(cookieA, new Blob([FIXTURE], { type: "application/pdf" }), "jntuk-r23-btech-cse.pdf");
    expect(res.status).toBe(202);
    expect(Date.now() - t0).toBeLessThan(8000); // returns promptly; the reading happens in the background
    const { id } = (await res.json()) as { id: string };

    const first = ((await (await get(cookieA, id)).json()) as { extraction: ExtractionRecord }).extraction;
    expect(first.status).toBe("processing");
    expect(await count(instA)).toBe(0);

    let rec = first;
    const deadline = Date.now() + 300_000;
    while (rec.status === "processing" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      rec = ((await (await get(cookieA, id)).json()) as { extraction: ExtractionRecord }).extraction;
    }
    expect(rec.status).toBe("ready");
    const rows = rec.result!.rows;
    expect(rows.length).toBeGreaterThanOrEqual(50);
    expect(new Set(rows.map((r) => `${r.year}-${r.semester}`))).toEqual(new Set(["2-1", "2-2", "3-1", "3-2", "4-1", "4-2"]));
    expect(rows.find((r) => /^database management systems$/i.test(r.name))).toMatchObject({ year: 2, semester: 2 });
    expect(rows.some((r) => r.suggestedAreaKeys.length > 0)).toBe(true);
    expect(rows.filter((r) => r.mappingNote === "no_outcomes").every((r) => r.suggestedAreaKeys.length === 0)).toBe(true);
    expect(await count(instA)).toBe(0); // still staged only

    // another institution's admin can't see it
    expect((await get(cookieB, id)).status).toBe(404);

    // confirm, exactly as the review UI does: the existing subjects route, then the existing mapping route
    const dbms = rows.find((r) => /^database management systems$/i.test(r.name))!;
    const add = await fetch(`${BASE}/api/admin/curriculum/subjects`, {
      method: "POST",
      headers: { cookie: cookieA, "content-type": "application/json" },
      body: JSON.stringify({ branch: rec.branch, year: dbms.year, semester: dbms.semester, subjects: [{ name: dbms.name }] }),
    });
    const added = (await add.json()) as { added: number; subjects: { name: string; id: string }[] };
    expect(added).toMatchObject({ added: 1 });
    const map = await fetch(`${BASE}/api/admin/curriculum/subjects/${added.subjects[0].id}/mapping`, {
      method: "PUT",
      headers: { cookie: cookieA, "content-type": "application/json" },
      body: JSON.stringify({ roleKey, areaKeys: dbms.suggestedAreaKeys, fromSuggestion: true }),
    });
    expect(map.status).toBe(200);
    expect(await count(instA)).toBe(1);
    expect(await count(instB)).toBe(0);
    expect((await fetch(`${BASE}/api/admin/curriculum/extractions/${id}`, { method: "DELETE", headers: { cookie: cookieA } })).status).toBe(200);
    expect((await get(cookieA, id)).status).toBe(404);
  }, 420_000);
});
