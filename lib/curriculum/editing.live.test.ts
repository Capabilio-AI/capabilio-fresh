import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { addCourses, createImport, createNewVersion, mergeCourse, publishImport, removeImport, saveCourse, setCourseRemoved, updateImport, FROZEN_MESSAGE } from "./writes";
import { applyDecisions, confirmHighConfidence } from "./mapping-writes";
import { getCourseDetail, getImportOverview, listImports } from "./admin-data";

// Real DB. Two throwaway institutions; every write goes through the same services the API routes call.
const service = liveServiceClient();
const stamp = Date.now();
let instA = "", instB = "", userId = "";
let adminA: { userId: string; institutionId: string }, adminB: typeof adminA;
let sql = "", dbms = "", stats = "";

const ok = <T extends { ok: boolean }>(r: T, label = "") => { expect(r.ok, `${label} ${JSON.stringify(r)}`).toBe(true); return r as Extract<T, { ok: true }>; };
async function freshImport(branch = "ZZ Branch", regulation: string | null = null) {
  return ok(await createImport(service, adminA, { branch, regulation }), "createImport").id;
}
async function course(importId: string, title: string, year = 2) {
  ok(await addCourses(service, adminA, importId, [{ year, semester: 1, title }]));
  return (await service.from("courses").select("id").eq("import_id", importId).eq("title", title).single()).data!.id;
}
const suggest = (courseId: string, skillId: string, confidence: number) => service.from("course_skill_mappings").insert({ course_id: courseId, skill_id: skillId, mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence });

beforeAll(async () => {
  const mk = async (l: string) => (await service.from("institutions").insert({ name: `ZZ EDIT ${l} ${stamp}`, slug: `zz-ed-${l.toLowerCase()}-${stamp}` }).select("id").single()).data!.id;
  [instA, instB] = await Promise.all([mk("A"), mk("B")]);
  userId = (await service.auth.admin.createUser({ email: `zz-ed-${stamp}@example.com`, password: "Zz-ed-pass-123!", email_confirm: true })).data.user!.id;
  adminA = { userId, institutionId: instA };
  adminB = { userId, institutionId: instB };
  const { data: skills } = await service.from("skills").select("id, key").in("key", ["SKILL_SQL", "SKILL_DBMS", "SKILL_STATISTICS"]);
  const id = (k: string) => skills!.find((s) => s.key === k)!.id;
  [sql, dbms, stats] = [id("SKILL_SQL"), id("SKILL_DBMS"), id("SKILL_STATISTICS")];
}, 60_000);

afterAll(async () => {
  await service.from("institutions").delete().in("id", [instA, instB]);
  await service.auth.admin.deleteUser(userId);
});

describe("curriculum editing (live DB)", () => {
  it("adds courses, skipping duplicates, and saves a whole course tree in one go", async () => {
    const imp = await freshImport();
    const added = ok(await addCourses(service, adminA, imp, [{ year: 2, semester: 2, title: "Database Systems" }, { year: 2, title: "database systems" }, { year: 3, title: "Operating Systems Lab" }]));
    expect(added).toMatchObject({ added: 2, skipped: 1 });
    const id = (await service.from("courses").select("id, kind").eq("import_id", imp).eq("title", "Database Systems").single()).data!.id;
    ok(await saveCourse(service, adminA, id, {
      title: "Database Management Systems", courseCode: "CS201", credits: 3, lectureHours: 3, objectives: ["Learn relational models"],
      outcomes: [{ code: "CO1", text: "Write SQL queries for data retrieval", bloomLevel: "Apply" }, { code: "CO2", text: "Design normalised schemas" }],
      units: [{ unitNo: 1, title: "Intro", hours: 8, topics: ["Data models", "ER diagrams"] }, { unitNo: 2, title: "SQL", topics: ["Joins"] }], experiments: ["Create tables"],
    }));
    const d = (await getCourseDetail(service, instA, id))!;
    expect(d.course).toMatchObject({ title: "Database Management Systems", course_code: "CS201", credits: 3 });
    expect(d.outcomes.map((o) => o.code)).toEqual(["CO1", "CO2"]);
    expect(d.outcomes[0].bloom_level).toBe("Apply");
    expect(d.units.map((u) => [u.unit_no, u.topics.length])).toEqual([[1, 2], [2, 1]]);
    expect(d.experiments).toEqual(["Create tables"]);
    expect(d.editable).toBe(true);
    const lab = (await service.from("courses").select("kind, is_lab").eq("import_id", imp).eq("title", "Operating Systems Lab").single()).data!;
    expect(lab).toEqual({ kind: "lab", is_lab: true });
  });

  it("re-saving keeps the mappings of an outcome that stays, and drops those of one that is removed", async () => {
    const imp = await freshImport();
    const id = await course(imp, "DBMS");
    ok(await saveCourse(service, adminA, id, { outcomes: [{ code: "CO1", text: "Write SQL queries for retrieval" }, { code: "CO2", text: "Design normalised schemas well" }] }));
    const outs = (await getCourseDetail(service, instA, id))!.outcomes;
    ok(await applyDecisions(service, adminA, id, [{ skillId: sql, decision: "confirm", outcomeId: outs[0].id }, { skillId: dbms, decision: "confirm", outcomeId: outs[1].id }]));
    ok(await saveCourse(service, adminA, id, { outcomes: [{ code: "CO1", text: "Write SQL queries for data retrieval (edited)" }] }));
    const after = (await getCourseDetail(service, instA, id))!;
    expect(after.outcomes).toHaveLength(1);
    expect(after.outcomes[0].id).toBe(outs[0].id); // same row: its mapping survived the edit
    expect(after.outcomes[0].mappings).toHaveLength(1);
    expect((await service.from("course_outcome_skill_mappings").select("id", { count: "exact", head: true }).eq("course_id", id)).count).toBe(1);
  });

  it("applies confirm / reject / clear with the approver from the session, and refuses bad input", async () => {
    const imp = await freshImport();
    const id = await course(imp, "Stats");
    await suggest(id, stats, 0.8);
    await suggest(id, dbms, 0.4);
    const r = ok(await applyDecisions(service, adminA, id, [
      { skillId: stats, decision: "confirm", importance: "CORE" }, { skillId: dbms, decision: "reject" }, { skillId: sql, decision: "confirm" },
    ]));
    expect(r).toMatchObject({ confirmed: 2, rejected: 1 });
    const rows = (await service.from("course_skill_mappings").select("skill_id, status, mapping_source, approved_by, approved_at, importance").eq("course_id", id)).data!;
    const by = (s: string) => rows.find((x) => x.skill_id === s)!;
    expect(by(stats)).toMatchObject({ status: "CONFIRMED", mapping_source: "COLLEGE_CONFIRMED", approved_by: userId, importance: "CORE" });
    expect(by(stats).approved_at).not.toBeNull();
    expect(by(dbms)).toMatchObject({ status: "REJECTED", approved_at: null });
    expect(by(sql)).toMatchObject({ status: "CONFIRMED", mapping_source: "MANUAL" }); // a skill nobody suggested, added by hand
    ok(await applyDecisions(service, adminA, id, [{ skillId: sql, decision: "clear" }]));
    expect((await service.from("course_skill_mappings").select("id", { count: "exact", head: true }).eq("course_id", id).eq("skill_id", sql)).count).toBe(0);
    expect(await applyDecisions(service, adminA, id, [{ skillId: "00000000-0000-0000-0000-000000000000", decision: "confirm" }])).toMatchObject({ ok: false, status: 400 });
    expect(await applyDecisions(service, adminA, id, [{ skillId: sql, decision: "confirm", outcomeId: "00000000-0000-0000-0000-000000000000" }])).toMatchObject({ ok: false, status: 400 });
    // a skill added by hand is MANUAL; a rejected one re-added is MANUAL too
    ok(await applyDecisions(service, adminA, id, [{ skillId: sql, decision: "confirm" }, { skillId: dbms, decision: "confirm" }]));
    const again = (await service.from("course_skill_mappings").select("skill_id, mapping_source, status").eq("course_id", id)).data!;
    expect(again.find((x) => x.skill_id === sql)).toMatchObject({ mapping_source: "MANUAL", status: "CONFIRMED" });
    expect(again.find((x) => x.skill_id === dbms)).toMatchObject({ mapping_source: "MANUAL", status: "CONFIRMED" });
  });

  it("bulk-confirms high-confidence suggestions only after a preview, and only exactly what was previewed", async () => {
    const imp = await freshImport();
    const a = await course(imp, "A1");
    const b = await course(imp, "B1");
    await suggest(a, sql, 0.9);
    await suggest(a, stats, 0.4);
    await suggest(b, sql, 0.95);
    const preview = ok(await confirmHighConfidence(service, adminA, imp, { minConfidence: 0.9, preview: true }));
    expect(preview.preview).toMatchObject({ count: 2, courseLevel: 2, courses: 2 });
    expect(preview.confirmed).toBe(0);
    expect((await service.from("course_skill_mappings").select("id", { count: "exact", head: true }).eq("status", "CONFIRMED").in("course_id", [a, b])).count).toBe(0); // preview wrote nothing
    expect(await confirmHighConfidence(service, adminA, imp, { minConfidence: 0.9, preview: false, expectedCount: 5 })).toMatchObject({ ok: false, status: 409 });
    expect(ok(await confirmHighConfidence(service, adminA, imp, { minConfidence: 0.9, preview: false, expectedCount: 2 })).confirmed).toBe(2);
    const rows = (await service.from("course_skill_mappings").select("confidence, status, mapping_source, approved_by").in("course_id", [a, b])).data!;
    expect(rows.filter((r) => r.status === "CONFIRMED").every((r) => r.mapping_source === "COLLEGE_CONFIRMED" && r.approved_by === userId)).toBe(true);
    expect(rows.find((r) => Number(r.confidence) === 0.4)!.status).toBe("SUGGESTED"); // below the bar: untouched
  });

  it("soft-deletes and restores a course; merges one into another without carrying mappings", async () => {
    const imp = await freshImport();
    const keep = await course(imp, "Networks");
    const gone = await course(imp, "Networks Lab");
    ok(await saveCourse(service, adminA, keep, { outcomes: [{ code: "CO1", text: "Explain network layers" }], units: [{ unitNo: 1, title: "Layers", topics: ["OSI"] }], objectives: ["Know layers"] }));
    ok(await saveCourse(service, adminA, gone, { outcomes: [{ code: "CO1", text: "Configure a small network" }, { code: "CO2", text: "Capture packets" }], units: [{ unitNo: 1, title: "Practice", topics: ["Wireshark"] }], objectives: ["Know layers", "Practise"], experiments: ["Packet capture"] }));
    await suggest(gone, sql, 0.9);
    ok(await mergeCourse(service, adminA, gone, keep));
    const d = (await getCourseDetail(service, instA, keep))!;
    expect(d.outcomes.map((o) => o.code)).toEqual(["CO1", "CO2", "CO3"]);
    expect(d.outcomes.map((o) => o.text)).toEqual(["Explain network layers", "Configure a small network", "Capture packets"]);
    expect(d.units.map((u) => [u.unit_no, u.title])).toEqual([[1, "Layers"], [2, "Practice"]]);
    expect(d.course.objectives).toEqual(["Know layers", "Practise"]); // de-duplicated, order kept
    expect(d.experiments).toEqual(["Packet capture"]);
    expect(d.mappings).toHaveLength(0);
    const o = (await getImportOverview(service, instA, imp))!;
    expect(o.courses.map((c) => c.title)).toEqual(["Networks"]);
    expect(o.removed.map((c) => c.title)).toEqual(["Networks Lab"]);
    ok(await setCourseRemoved(service, adminA, keep, true));
    expect((await getImportOverview(service, instA, imp))!.courses).toHaveLength(0);
    ok(await setCourseRemoved(service, adminA, keep, false));
    expect((await getImportOverview(service, instA, imp))!.courses).toHaveLength(1);
    expect(await mergeCourse(service, adminA, keep, keep)).toMatchObject({ ok: false });
  });

  it("walks the review statuses, refuses to confirm an empty curriculum, and never reaches PUBLISHED by status", async () => {
    const imp = await freshImport();
    expect(await updateImport(service, adminA, imp, { status: "CONFIRMED" })).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/at least one course/) });
    await course(imp, "Compilers");
    ok(await updateImport(service, adminA, imp, { status: "CONFIRMED", regulation: "ZZ-R1", program: "B.Tech" }));
    const o = (await getImportOverview(service, instA, imp))!;
    expect(o.import).toMatchObject({ status: "CONFIRMED", regulation: "ZZ-R1", program: "B.Tech" });
    ok(await updateImport(service, adminA, imp, { status: "UNDER_REVIEW" })); // back for more editing
    expect((await publishImport(service, adminA, imp))).toMatchObject({ ok: false, status: 409 }); // not confirmed
  });

  it("publishes a confirmed curriculum, then freezes every edit path with a clear message", async () => {
    const imp = await freshImport("ZZ Publish", "ZZ-P1");
    const id = await course(imp, "Machine Learning");
    await suggest(id, stats, 0.9);
    ok(await updateImport(service, adminA, imp, { status: "CONFIRMED" }));
    const pub = ok(await publishImport(service, adminA, imp));
    expect(pub.versionId).toBeTruthy();
    expect((await getImportOverview(service, instA, imp))!).toMatchObject({ versionNo: 1, summary: { status: "PUBLISHED" } });
    for (const r of [
      await saveCourse(service, adminA, id, { title: "Changed" }),
      await setCourseRemoved(service, adminA, id, true),
      await addCourses(service, adminA, imp, [{ year: 1, title: "New" }]),
      await applyDecisions(service, adminA, id, [{ skillId: stats, decision: "confirm" }]),
      await updateImport(service, adminA, imp, { regulation: "x" }),
      await confirmHighConfidence(service, adminA, imp, { minConfidence: 0.9, preview: true }),
    ]) expect(r).toMatchObject({ ok: false, status: 409, message: FROZEN_MESSAGE });
    expect(await removeImport(service, adminA, imp)).toMatchObject({ ok: false, status: 409 });
    expect((await listImports(service, instA)).find((i) => i.id === imp)).toMatchObject({ status: "PUBLISHED", versionNo: 1 });
  });

  it("a curriculum whose courses were all removed cannot be published", async () => {
    const imp = await freshImport("ZZ Empty", "ZZ-E1");
    const id = await course(imp, "Only Course");
    ok(await updateImport(service, adminA, imp, { status: "CONFIRMED" }));
    ok(await setCourseRemoved(service, adminA, id, true));
    expect(await publishImport(service, adminA, imp)).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/no courses/) });
  });

  it("another institution's admin can neither see nor change any of it", async () => {
    const imp = await freshImport();
    const id = await course(imp, "Private Course");
    expect(await getImportOverview(service, instB, imp)).toBeNull();
    expect(await getCourseDetail(service, instB, id)).toBeNull();
    for (const r of [
      await updateImport(service, adminB, imp, { regulation: "x" }), await removeImport(service, adminB, imp), await addCourses(service, adminB, imp, [{ year: 1, title: "x" }]),
      await saveCourse(service, adminB, id, { title: "x" }), await setCourseRemoved(service, adminB, id, true), await publishImport(service, adminB, imp),
      await applyDecisions(service, adminB, id, [{ skillId: sql, decision: "confirm" }]), await confirmHighConfidence(service, adminB, imp, { minConfidence: 0.9, preview: true }),
    ]) expect(r).toMatchObject({ ok: false, status: 404 });
    expect((await listImports(service, instB)).length).toBe(0);
  });

  it("soft-deleting an unpublished curriculum hides it everywhere but keeps the row", async () => {
    const imp = await freshImport();
    await course(imp, "Temp");
    ok(await removeImport(service, adminA, imp));
    expect(await getImportOverview(service, instA, imp)).toBeNull();
    expect((await listImports(service, instA)).some((i) => i.id === imp)).toBe(false);
    expect((await service.from("curriculum_imports").select("deleted_at").eq("id", imp).single()).data!.deleted_at).not.toBeNull();
  });

  it("a new version copies everything (mappings keep their status and approval), is editable, and publishing it archives the old one", async () => {
    const imp = await freshImport("ZZ Versioned", "ZZ-V1");
    const id = await course(imp, "Operating Systems");
    ok(await saveCourse(service, adminA, id, {
      objectives: ["Understand processes"], outcomes: [{ code: "CO1", text: "Explain process scheduling" }, { code: "CO2", text: "Implement a simple shell" }],
      units: [{ unitNo: 1, title: "Processes", topics: ["Scheduling", "Threads"] }], experiments: ["Write a shell"], textbooks: ["OS Concepts"],
    }));
    const co1 = (await getCourseDetail(service, instA, id))!.outcomes[0].id;
    await suggest(id, dbms, 0.7);
    ok(await applyDecisions(service, adminA, id, [{ skillId: sql, decision: "confirm", importance: "CORE" }, { skillId: stats, decision: "confirm", outcomeId: co1 }]));
    await service.from("course_skill_mappings").insert({ course_id: id, skill_id: stats, mapping_source: "AI_SUGGESTED", status: "REJECTED", confidence: 0.2 });
    expect(await createNewVersion(service, adminA, imp)).toMatchObject({ ok: false, status: 409 }); // not published yet
    ok(await updateImport(service, adminA, imp, { status: "CONFIRMED" }));
    ok(await publishImport(service, adminA, imp));

    const v2 = ok(await createNewVersion(service, adminA, imp), "clone").id;
    expect(v2).not.toBe(imp);
    expect(await createNewVersion(service, adminA, imp)).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/already in progress/) });
    const o2 = (await getImportOverview(service, instA, v2))!;
    expect(o2.import).toMatchObject({ status: "UNDER_REVIEW", regulation: "ZZ-V1", branch: "ZZ Versioned" });
    const c2 = o2.courses[0];
    expect(c2.id).not.toBe(id);
    expect(c2).toMatchObject({ title: "Operating Systems", outcomes: 2, units: 1 });
    const d2 = (await getCourseDetail(service, instA, c2.id))!;
    expect(d2.course.objectives).toEqual(["Understand processes"]);
    expect(d2.course.textbooks).toEqual(["OS Concepts"]);
    expect(d2.experiments).toEqual(["Write a shell"]);
    expect(d2.units[0].topics).toEqual(["Scheduling", "Threads"]);
    expect(d2.mappings.map((m) => [m.skillName, m.status]).sort()).toEqual([["SQL", "CONFIRMED"], ["Statistics", "REJECTED"], ["Database Management Systems", "SUGGESTED"]].sort());
    const sqlRow = d2.mappings.find((m) => m.skillId === sql)!;
    expect(sqlRow).toMatchObject({ status: "CONFIRMED", source: "MANUAL", importance: "CORE" });
    expect(sqlRow.approvedAt).not.toBeNull(); // the approval survived the copy
    expect(d2.outcomes[0].mappings.map((m) => m.status)).toEqual(["CONFIRMED"]); // outcome-level mapping copied onto the NEW outcome

    // the copy is editable; the original stays frozen
    ok(await saveCourse(service, adminA, c2.id, { title: "Operating Systems (revised)" }));
    expect(await saveCourse(service, adminA, id, { title: "x" })).toMatchObject({ ok: false, status: 409 });
    expect(await createNewVersion(service, adminB, imp)).toMatchObject({ ok: false, status: 404 });

    ok(await updateImport(service, adminA, v2, { status: "CONFIRMED" }));
    ok(await publishImport(service, adminA, v2));
    const after = (await service.from("curriculum_imports").select("id, status, supersedes_import_id").in("id", [imp, v2])).data!;
    expect(after.find((r) => r.id === imp)!.status).toBe("ARCHIVED");
    expect(after.find((r) => r.id === v2)).toMatchObject({ status: "PUBLISHED", supersedes_import_id: imp });
    expect((await getImportOverview(service, instA, v2))!.versionNo).toBe(2);
  });
});

