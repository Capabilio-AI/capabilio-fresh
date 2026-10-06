import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { listEnabledRoles, loadRoleTaxonomy } from "@/lib/arena-workstations/taxonomy";
import { untyped } from "@/lib/org/db";
import { addSubjects, setMapping } from "../curriculum-writes";
import { createExtraction, deleteExtraction, getExtraction, hasActiveJob, latestExtraction } from "./store";
import { runExtraction } from "./run";
import type { ExtractionDeps } from "./build";

// Real DB. The AI is stubbed (deterministic); everything else — PDF, chunking, staging, scoping — is real.
const service = liveServiceClient();
const FIXTURE = new Uint8Array(readFileSync("docs/fixtures/jntuk-r23-btech-cse.pdf"));
type U = { userId: string; email: string; password: string };
let adminA: U, adminB: U;
let asAdminA: SupabaseClient<Database>;
let instA: string, instB: string, roleKey: string;
const stamp = Date.now();

const deps: ExtractionDeps = {
  structureSemester: async (c) =>
    c.year === 2 && c.semester === 2
      ? [{ year: 2, semester: 2, name: "Database Management Systems", code: null, category: "Professional Core", kind: "course", confidence: "high", needsReview: false, reason: null }]
      : [],
  suggestAreas: async (items) => new Map(items.map((i) => [i.id, /database/i.test(i.title) ? ["sql"] : []])),
};

async function makeInstitution(label: string) {
  const { data } = await service.from("institutions").insert({ name: `ZZ EXTRACT ${label} ${stamp}`, slug: `zz-ex-${label.toLowerCase()}-${stamp}` }).select("id").single();
  return data!.id;
}
async function principal(userId: string, institutionId: string) {
  await service.from("institution_memberships").insert({ user_id: userId, institution_id: institutionId, role: "principal" });
  await service.from("institution_memberships").update({ status: "active" }).eq("user_id", userId).eq("institution_id", institutionId);
}
const subjectCount = async (inst: string) => (await service.from("curriculum_subjects").select("id", { count: "exact", head: true }).eq("institution_id", inst)).count ?? 0;

describe("syllabus extraction: staging, scoping, authority", () => {
  beforeAll(async () => {
    [adminA, adminB] = await Promise.all(["a", "b"].map((l) => createThrowawayUserWithLogin(service, `ex-${l}`)));
    [instA, instB] = await Promise.all([makeInstitution("A"), makeInstitution("B")]);
    await Promise.all([principal(adminA.userId, instA), principal(adminB.userId, instB)]);
    asAdminA = await signedInClient(adminA.email, adminA.password);
    roleKey = (await listEnabledRoles(service))[0].role_key;
  }, 60_000);

  afterAll(async () => {
    await untyped(service).from("curriculum_extractions").delete().in("institution_id", [instA, instB]);
    await service.from("curriculum_subjects").delete().in("institution_id", [instA, instB]);
    await service.from("institution_memberships").delete().in("institution_id", [instA, instB]);
    await service.from("institutions").delete().in("id", [instA, instB]);
    await Promise.all([adminA, adminB].map((u) => deleteThrowawayUser(service, u.userId)));
  });

  it("no client — not even an admin — can read or write the staging table directly", async () => {
    expect((await asAdminA.from("curriculum_extractions" as never).select("*").limit(1)).error).not.toBeNull();
    expect((await asAdminA.from("curriculum_extractions" as never).insert({} as never).select()).error).not.toBeNull();
    expect((await asAdminA.from("curriculum_extractions" as never).delete().eq("institution_id", instA)).error).not.toBeNull();
  });

  it("the upload returns a processing record immediately; the job later completes it — and writes nothing to curriculum_subjects", async () => {
    const t0 = Date.now();
    const id = (await createExtraction(service, { institutionId: instA, userId: adminA.userId, branch: "ZZ CSE", roleKey, fileName: "jntuk.pdf", fileBytes: FIXTURE.length }))!;
    expect(Date.now() - t0).toBeLessThan(3000);
    expect((await getExtraction(service, instA, adminA.userId, id))?.status).toBe("processing");
    expect(await hasActiveJob(service, instA)).toBe(true);

    await runExtraction(service, { id, institutionId: instA, userId: adminA.userId, branch: "ZZ CSE", fileName: "jntuk.pdf", bytes: FIXTURE, roleKey }, deps);
    const done = await getExtraction(service, instA, adminA.userId, id);
    expect(done?.status).toBe("ready");
    const dbms = done!.result!.rows.find((r) => r.name === "Database Management Systems")!;
    expect(dbms).toMatchObject({ year: 2, semester: 2, suggestedAreaKeys: ["sql"] });
    expect(await hasActiveJob(service, instA)).toBe(false);

    expect(await subjectCount(instA)).toBe(0); // staged only — nothing is a curriculum record yet
    expect((await latestExtraction(service, instA, adminA.userId))?.id).toBe(id);

    // Phase 3: the full tree was saved as an unpublished draft import, linked to the staged extraction.
    const importId = (done!.result as { importId?: string | null }).importId!;
    expect(importId).toBeTruthy();
    const { data: imp } = await service.from("curriculum_imports").select("status, regulation, program, institution_id, source_file_name, extraction_version").eq("id", importId).single();
    expect(imp).toMatchObject({ status: "EXTRACTED", regulation: "R23", program: "B.Tech", institution_id: instA, source_file_name: "jntuk.pdf" });
    const { data: link } = await service.from("curriculum_extractions").select("import_id").eq("id", id).single();
    expect(link!.import_id).toBe(importId);

    const { data: courses } = await service.from("courses").select("id, title, year, semester, credits, objectives, textbooks").eq("import_id", importId);
    expect(courses!.length).toBe(done!.result!.rows.length);
    const db = courses!.find((c) => c.title === "DATABASE MANAGEMENT SYSTEMS" || /^database management systems$/i.test(c.title))!;
    expect(db).toMatchObject({ year: 2, semester: 2, credits: 3 });
    expect(db.objectives).toHaveLength(4);
    const { data: cos } = await service.from("course_outcomes").select("code, bloom_level").eq("course_id", db.id).order("sort_order");
    expect(cos!.map((c) => c.code)).toEqual(["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"]);
    expect(cos![0].bloom_level).toBe("Understand");
    expect((await service.from("course_units").select("id", { count: "exact", head: true }).eq("course_id", db.id)).count).toBe(5);
    const { data: po } = await service.from("program_outcomes").select("kind").eq("import_id", importId);
    expect(po!.filter((p) => p.kind === "PO")).toHaveLength(12);
    expect(po!.filter((p) => p.kind === "PSO")).toHaveLength(3);

    // nothing is published, and no mapping anywhere is confirmed
    expect((await service.from("curriculum_versions").select("id", { count: "exact", head: true }).eq("institution_id", instA)).count).toBe(0);
    const ids = courses!.map((c) => c.id);
    expect((await service.from("course_skill_mappings").select("id", { count: "exact", head: true }).in("course_id", ids).eq("status", "CONFIRMED")).count).toBe(0);
  }, 90_000);

  it("another institution's admin can neither read nor delete it", async () => {
    const id = (await latestExtraction(service, instA, adminA.userId))!.id;
    expect(await getExtraction(service, instB, adminB.userId, id)).toBeNull();
    expect(await getExtraction(service, instA, adminB.userId, id)).toBeNull(); // scoped to the uploader too
    expect(await deleteExtraction(service, instB, adminB.userId, id)).toBe(false);
    expect(await getExtraction(service, instA, adminA.userId, id)).not.toBeNull();
  });

  it("confirming goes through the existing write path: subjects for the admin's own institution, mapping as confirmed", async () => {
    const { areas } = await loadRoleTaxonomy(service, roleKey);
    const sql = areas.find((a) => a.area_key === "sql");
    const res = await addSubjects(service, { userId: adminA.userId, institutionId: instA }, { branch: "ZZ CSE", year: 2, semester: 2, subjects: [{ name: "Database Management Systems" }] });
    expect(res).toMatchObject({ ok: true, count: 1 });
    const created = res.ok ? res.subjects![0] : null;
    expect(created?.name).toBe("Database Management Systems");
    if (sql && created) {
      expect(await setMapping(service, { userId: adminA.userId, institutionId: instA }, created.id, roleKey, ["sql"], true)).toMatchObject({ ok: true, count: 1 });
      const { data } = await service.from("curriculum_subject_skill_map").select("source").eq("subject_id", created.id);
      expect(data?.[0]?.source).toBe("ai_suggestion_confirmed");
    }
    expect(await subjectCount(instA)).toBe(1);
    expect(await subjectCount(instB)).toBe(0);
    // re-importing the same subject is skipped and returns no id, so an existing mapping is never overwritten
    const again = await addSubjects(service, { userId: adminA.userId, institutionId: instA }, { branch: "ZZ CSE", year: 2, semester: 2, subjects: [{ name: "database management systems" }] });
    expect(again).toMatchObject({ ok: true, count: 0, subjects: [] });
  });

  it("discarding the staged extraction soft-deletes its unpublished draft import", async () => {
    const rec = (await latestExtraction(service, instA, adminA.userId))!;
    const importId = (rec.result as { importId?: string | null }).importId!;
    expect(await deleteExtraction(service, instA, adminA.userId, rec.id)).toBe(true);
    const { data } = await service.from("curriculum_imports").select("deleted_at, status").eq("id", importId).single();
    expect(data!.deleted_at).not.toBeNull();
    expect(data!.status).toBe("EXTRACTED");
  });

  it("a no-text-layer PDF ends in an honest failed state", async () => {
    const id = (await createExtraction(service, { institutionId: instB, userId: adminB.userId, branch: "ZZ", roleKey, fileName: "scan.pdf", fileBytes: 200 }))!;
    const scan = new TextEncoder().encode("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF");
    await runExtraction(service, { id, institutionId: instB, userId: adminB.userId, branch: "ZZ", fileName: "scan.pdf", bytes: scan, roleKey }, deps);
    const rec = await getExtraction(service, instB, adminB.userId, id);
    expect(rec).toMatchObject({ status: "failed", errorCode: "no_text_layer", result: null });
    expect((await untyped(service).from("curriculum_extractions").select("result").eq("id", id).single()).data).toMatchObject({ result: null });
    expect(await subjectCount(instB)).toBe(0);
  }, 30_000);
});
