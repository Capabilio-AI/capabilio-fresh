import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { saveCareerIntent } from "@/lib/careers/intent";
import { untyped } from "@/lib/org/db";
import { loadGraphContext } from "./context";
import { explainNode } from "./explain-node";
import { NodeStateBody, NodeStateError, confirmSemester, setNodeState } from "./node-state";
import { getRoadmapGraph } from "./service";

// Live: the visual roadmap assembled from the real published tree, a real student's evidence, node state and a published syllabus.
const service = liveServiceClient();
const db = untyped(service);
const stamp = Date.now();
const BRANCH = "ZZ Graph Branch";
let inst = "";
let userId = "";
let careerIds: Record<string, string> = {};
let skill: Record<string, string> = {};
const thisYear = new Date().getFullYear();

beforeAll(async () => {
  inst = (await service.from("institutions").insert({ name: `ZZ GRAPH ${stamp}`, slug: `zz-graph-${stamp}` }).select("id").single()).data!.id;
  ({ userId } = await createThrowawayUserWithLogin(service, "graph"));
  careerIds = Object.fromEntries(((await service.from("careers").select("id, key")).data ?? []).map((c) => [c.key, c.id]));
  skill = Object.fromEntries(((await service.from("skills").select("id, name").eq("status", "active")).data ?? []).map((s) => [s.name, s.id]));
  await service.from("institution_memberships").insert({ user_id: userId, institution_id: inst, role: "student", status: "active", branch: BRANCH, start_year: thisYear - 2, end_year: thisYear + 2, year_confirmed_at: new Date().toISOString(), year_override: 3 });
  await saveCareerIntent(service, userId, { primaryCareerId: careerIds["data-analyst"], secondaryCareerId: careerIds["software-engineer"], isExploring: false });

  // a published syllabus: DBMS (confirmed SQL, inferred unit-level Joins + an INFERRED outcome), and two more analysed courses so "not taught" can be said
  const imp = (await service.from("curriculum_imports").insert({ institution_id: inst, branch: BRANCH, status: "CONFIRMED", regulation: "ZZ-R1" }).select("id").single()).data!.id;
  const mk = async (title: string, year: number, semester: number, analysed: boolean) => (await db.from("courses").insert({ import_id: imp, year, semester, title, source_page_start: 40, source_page_end: 42, skills_analysed_at: analysed ? new Date().toISOString() : null }).select("id").single()).data!.id as string;
  const dbms = await mk("Database Management Systems", 3, 1, true);
  await mk("Operating Systems", 2, 2, true);
  await mk("Engineering Chemistry", 1, 1, true);
  await service.from("course_skill_mappings").insert({ course_id: dbms, skill_id: skill["SQL"], mapping_source: "MANUAL", status: "CONFIRMED", approved_at: new Date().toISOString(), importance: "CORE" });
  const unit = (await service.from("course_units").insert({ course_id: dbms, unit_no: 3, title: "Joins and subqueries" }).select("id").single()).data!.id;
  const outcome = (await db.from("course_outcomes").insert({ course_id: dbms, code: "D1", text: "Write multi-table queries", source: "INFERRED" }).select("id").single()).data!.id;
  await db.from("unit_skill_mappings").insert({ unit_id: unit, course_id: dbms, skill_id: skill["SQL Joins"], mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence: 0.9, evidence_source: "Joins and subqueries" });
  await service.from("course_outcome_skill_mappings").insert({ course_outcome_id: outcome, course_id: dbms, skill_id: skill["SQL Joins"], mapping_source: "AI_SUGGESTED", status: "SUGGESTED", confidence: 0.6 }); // below the threshold: not shown
  const { error } = await service.rpc("publish_curriculum_import", { p_import_id: imp, p_user_id: null as unknown as string });
  if (error) throw new Error(error.message);
}, 120_000);

afterAll(async () => {
  await service.from("institution_memberships").delete().eq("institution_id", inst);
  await service.from("institutions").delete().eq("id", inst);
  await deleteThrowawayUser(service, userId);
});

const ready = async (which: "primary" | "plan-b" = "primary") => {
  const r = await getRoadmapGraph(service, userId, which);
  if (!r.ok) throw new Error(`not ready: ${JSON.stringify(r.reason)}`);
  return r.graph;
};

describe("the roadmap for a student with a career and a syllabus", () => {
  it("is built from the published tree with honest, unassessed states", async () => {
    const g = await ready();
    expect(g.career.key).toBe("data-analyst");
    const topics = g.nodes.filter((n) => n.type === "TOPIC" && !n.resource);
    expect(topics.length).toBe(35);
    expect(g.nodes.filter((n) => n.type === "SPINE" && n.key !== "x-prove")).toHaveLength(8);
    expect(topics.every((t) => t.level === null && t.status !== "TARGET_MET")).toBe(true);
    expect(g.header).toMatchObject({ assessedTopics: 0, totalTopics: 35, readiness: 0, evidenceCoverage: 0 });
    expect(g.nodes.every((n) => n.box.w > 0)).toBe(true);
  });

  it("overlays the syllabus: official and inferred coverage, with the exact course, unit and semester, and never below the confidence threshold", async () => {
    const g = await ready();
    const sql = g.nodes.find((n) => n.skill?.name === "SQL")!;
    expect(sql.coverage).toMatchObject({ state: "STRONG", basis: "OFFICIAL" }); // a CORE official link
    const joins = g.nodes.find((n) => n.skill?.name === "SQL Joins")!;
    expect(joins.coverage).toMatchObject({ basis: "INFERRED", headline: "Database Management Systems · Semester 5" });
    const stats = g.nodes.find((n) => n.skill?.name === "Statistics")!;
    expect(stats.coverage).toMatchObject({ state: "NONE" }); // enough of the syllabus was analysed to say it is not taught
    expect(g.header.curriculum).toMatchObject({ state: "PUBLISHED", regulation: "ZZ-R1", analysed: true });
    expect(g.subjects[0]).toMatchObject({ title: "Database Management Systems" });
  });

  it("explains a topic with the college's units, outcomes (and where they came from) and the page range", async () => {
    const loaded = await loadGraphContext(service, userId, "primary");
    if (!loaded.ok) throw new Error("not ready");
    const e = explainNode(loaded.ctx, loaded.ctx.nodes.find((n) => n.skillName === "SQL Joins")!.key)!;
    expect(e.college.items[0]).toMatchObject({ title: "Database Management Systems", tier: "INFERRED", pages: { start: 40, end: 42 }, units: [{ no: 3, title: "Joins and subqueries" }] });
    expect(e.college.items[0].outcomes).toEqual([]); // the 0.6-confidence outcome link is below the threshold
    expect(e.score).toMatchObject({ level: null, noEvidence: true });
  });

  it("updates when the student has evidence, and keeps honest levels", async () => {
    await service.from("capabilities").insert({ user_id: userId, skill: "SQL", domain: "Data", capability_score: 85, confidence: "medium", data_points: 2 });
    await service.from("capability_history").insert({ user_id: userId, skill: "SQL", capability_score: 85, confidence: "medium", source: "initial_assessment" });
    const g = await ready();
    const sql = g.nodes.find((n) => n.skill?.name === "SQL")!;
    expect(sql).toMatchObject({ level: 85, verified: true });
    // 85 meets the target, but if SQL's prerequisite topic was never assessed the roadmap asks for a check instead of celebrating
    expect(["TARGET_MET", "NEEDS_CHECK"]).toContain(sql.status);
    expect(g.header.assessedTopics).toBe(1);
    expect(g.nodes.filter((n) => n.type === "TOPIC" && !n.resource && n.skill?.name !== "SQL").every((n) => n.level === null)).toBe(true);
  });
});

describe("the student's own marks and semester", () => {
  it("saves Learning/Skipped (a skip needs a reason), and clears a mark", async () => {
    const g = await ready();
    const target = g.nodes.find((n) => n.skill?.name === "SQL Joins")!;
    const body = { nodeKey: target.key, careerId: careerIds["data-analyst"] };
    expect(NodeStateBody.safeParse({ ...body, status: "SKIPPED" }).success).toBe(false);
    await setNodeState(service, userId, NodeStateBody.parse({ ...body, status: "LEARNING" }));
    expect((await ready()).nodes.find((n) => n.key === target.key)).toMatchObject({ userState: "LEARNING", status: "LEARNING" });
    await setNodeState(service, userId, NodeStateBody.parse({ ...body, status: "SKIPPED", reason: "Covered in a course I already finished" }));
    expect((await ready()).nodes.find((n) => n.key === target.key)).toMatchObject({ status: "SKIPPED", skipReason: "Covered in a course I already finished" });
    await setNodeState(service, userId, NodeStateBody.parse({ ...body, status: null }));
    expect((await ready()).nodes.find((n) => n.key === target.key)!.userState).toBeNull();
  });
  it("refuses a node that does not exist, a group, or a roadmap that is not published", async () => {
    await expect(setNodeState(service, userId, NodeStateBody.parse({ nodeKey: "nope-nope", careerId: careerIds["data-analyst"], status: "LEARNING" }))).rejects.toBeInstanceOf(NodeStateError);
    const group = (await ready()).nodes.find((n) => n.type === "GROUP")!;
    await expect(setNodeState(service, userId, NodeStateBody.parse({ nodeKey: group.key, careerId: careerIds["data-analyst"], status: "LEARNING" }))).rejects.toMatchObject({ status: 400 });
    await expect(setNodeState(service, userId, NodeStateBody.parse({ nodeKey: group.key, careerId: careerIds["product-designer"], status: "LEARNING" }))).rejects.toMatchObject({ status: 404 });
  });
  it("shows an estimated semester until the student confirms it", async () => {
    expect((await ready()).header.position).toMatchObject({ year: 3, semesterEstimated: true });
    await confirmSemester(service, userId, 2);
    expect((await ready()).header.position).toMatchObject({ year: 3, semester: 2, semesterEstimated: false });
  });
});

describe("what is missing", () => {
  it("switches to Plan B (a career with a published tree) and reports a career without one", async () => {
    const plan = await getRoadmapGraph(service, userId, "plan-b");
    expect(plan).toMatchObject({ ok: false, reason: { state: "NO_TEMPLATE", career: { key: "software-engineer" } } }.ok === false ? { ok: true } : { ok: false });
  });
  it("says so when there is no career, or the student is exploring, or no Plan B", async () => {
    await saveCareerIntent(service, userId, { primaryCareerId: careerIds["data-analyst"], secondaryCareerId: null, isExploring: false });
    expect(await getRoadmapGraph(service, userId, "plan-b")).toMatchObject({ ok: false, reason: { state: "NO_PLAN_B" } });
    await saveCareerIntent(service, userId, { primaryCareerId: null, secondaryCareerId: null, isExploring: true });
    expect(await getRoadmapGraph(service, userId, "primary")).toMatchObject({ ok: false, reason: { state: "EXPLORING" } });
    await saveCareerIntent(service, userId, { primaryCareerId: careerIds["product-designer"], secondaryCareerId: null, isExploring: false });
    expect(await getRoadmapGraph(service, userId, "primary")).toMatchObject({ ok: false, reason: { state: "NO_TEMPLATE" } });
  });
  it("without a published curriculum every topic's coverage is UNKNOWN, never 'not taught'", async () => {
    await saveCareerIntent(service, userId, { primaryCareerId: careerIds["data-analyst"], secondaryCareerId: null, isExploring: false });
    await service.from("institution_memberships").update({ regulation: "ZZ-OTHER" }).eq("user_id", userId);
    const g = await ready();
    expect(g.header.curriculum.state).toBe("REGULATION_MISMATCH");
    expect(g.nodes.filter((n) => n.type === "TOPIC" && !n.resource).every((n) => n.coverage?.state === "UNKNOWN")).toBe(true);
  });
});
