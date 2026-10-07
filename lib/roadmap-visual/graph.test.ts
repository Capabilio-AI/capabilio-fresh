import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph-build";
import { explainNode, explainReadiness, explainSubject } from "./explain-node";
import { course, makeContext, resource } from "./graph.fixture";

const nodeOf = (g: ReturnType<typeof buildGraph>, key: string) => g.nodes.find((n) => n.key === key)!;

describe("buildGraph: honest node states", () => {
  const g = buildGraph(makeContext({}, { "s-sql": [{ kind: "ASSESSMENT", level: 85, observedAt: new Date("2026-10-01"), label: "x" }], "s-stats": [{ kind: "ASSESSMENT", level: 30, observedAt: new Date("2026-10-01"), label: "x" }] }));
  it("separates not-assessed from assessed-below-target and target-met", () => {
    expect(nodeOf(g, "sql")).toMatchObject({ level: 85, status: "TARGET_MET", verified: true });
    expect(nodeOf(g, "stats")).toMatchObject({ level: 30, status: "NOT_STARTED" });
    expect(nodeOf(g, "joins")).toMatchObject({ level: null, confidence: null, verified: false });
  });
  it("never shows a level of 0 for a topic nobody measured", () => {
    for (const n of g.nodes.filter((x) => x.type === "TOPIC" && x.skill && x.key !== "sql" && x.key !== "stats")) expect(n.level).toBeNull();
  });
  it("flags a high score over a prerequisite that was never assessed", () => {
    const flagged = buildGraph(makeContext({}, { "s-win": [{ kind: "ASSESSMENT", level: 90, observedAt: new Date("2026-10-01"), label: "x" }] }));
    expect(nodeOf(flagged, "windows")).toMatchObject({ status: "NEEDS_CHECK" });
    expect(nodeOf(flagged, "windows").needsCheck).toMatch(/Check this score/);
  });
  it("marks a topic locked while a prerequisite is pending, and unlocks it once the prerequisite is done", () => {
    expect(nodeOf(g, "joins")).toMatchObject({ locked: false }); // sql is at target
    expect(nodeOf(g, "windows")).toMatchObject({ locked: true, status: "LOCKED", prerequisites: ["joins"] });
    const done = buildGraph(makeContext({ userStates: new Map([["joins", { status: "DONE" as const, reason: null }]]) }));
    expect(nodeOf(done, "windows").locked).toBe(false);
    expect(nodeOf(done, "joins")).toMatchObject({ status: "DONE", userState: "DONE" });
  });
  it("rolls stages and groups up from their topics, with evidence coverage", () => {
    expect(nodeOf(g, "stage-a")).toMatchObject({ topics: 2, assessedTopics: 1, evidenceCoverage: 50 });
    expect(nodeOf(g, "g-a").progress).toBe(Math.round(((3 * 1) / 6) * 100));
  });
  it("reports readiness with the evidence it rests on", () => {
    expect(g.header).toMatchObject({ totalTopics: 4, assessedTopics: 2 });
    expect(g.header.evidenceCoverage).toBeLessThan(100);
    expect(g.header.readiness).toBeGreaterThan(0);
  });
  it("gives every node a position and links the stages and groups", () => {
    expect(g.nodes.every((n) => n.box.w > 0)).toBe(true);
    expect(g.edges.filter((e) => e.kind === "SPINE_NEXT")).toHaveLength(1);
    expect(g.edges.filter((e) => e.kind === "SPINE_GROUP").map((e) => [e.from, e.to])).toEqual([["stage-a", "g-a"], ["stage-b", "g-b"]]);
    expect(g.edges.filter((e) => e.kind === "GROUP_TOPIC").map((e) => [e.from, e.to])).toEqual([["g-a", "sql"], ["g-a", "joins"], ["g-b", "windows"], ["g-b", "stats"]]);
  });
});

describe("projects and certifications on the map", () => {
  const pool = (items: [string, ReturnType<typeof resource>][]) => ({ bySkill: new Map(items.map(([k, r]) => [k, [r]] as const)), byNode: new Map() });
  it("adds a final stage with the projects and certifications that build this career's skills, most relevant first", () => {
    const proj = resource({ id: "p1", kind: "PROJECT", title: "Build a dashboard", difficulty: "BEGINNER" });
    const cert = resource({ id: "c1", kind: "CERTIFICATION", title: "Data cert", tier: "PREMIUM" });
    const resources = { bySkill: new Map([["s-sql", [proj, cert]], ["s-joins", [proj]]]), byNode: new Map() };
    const g = buildGraph(makeContext({ resources }));
    const last = g.nodes.filter((n) => n.type === "SPINE").at(-1)!;
    expect(last).toMatchObject({ key: "x-prove", title: "Build and prove it" });
    expect(g.nodes.filter((n) => n.resource).map((n) => [n.resource!.title, n.side])).toEqual([["Build a dashboard", "LEFT"], ["Data cert", "RIGHT"]]);
    expect(g.nodes.find((n) => n.key === "x-prove-projects-0")!.box.y).toBeGreaterThan(g.nodes.find((n) => n.key === "stage-b")!.box.y);
    expect(g.edges.some((e) => e.kind === "SPINE_NEXT" && e.to === "x-prove")).toBe(true);
    expect(g.header.totalTopics).toBe(4); // synthetic items never count as career topics
  });
  it("adds nothing when the catalog has nothing for the career", () => expect(buildGraph(makeContext()).nodes.some((n) => n.key === "x-prove")).toBe(false));
});

describe("buildGraph: the college overlay", () => {
  it("is UNKNOWN (never 'not taught') without a published curriculum", () => {
    const g = buildGraph(makeContext());
    expect(nodeOf(g, "sql").coverage).toMatchObject({ state: "UNKNOWN", courses: 0 });
    expect(g.header.curriculum.state).toBe("NONE");
    expect(g.subjects).toEqual([]);
  });
  it("names the course and semester for a covered topic and ranks the subject", () => {
    const dbms = course("dbms", { year: 3, semester: 1, links: [{ skillId: "s-sql", tier: "OFFICIAL", confidence: null, level: "COURSE", importance: "CORE" }, { skillId: "s-joins", tier: "INFERRED", confidence: 0.9, level: "UNIT", unitId: "dbms-u1" }] });
    const g = buildGraph(makeContext({ curriculum: { state: "PUBLISHED", courses: [dbms, course("x"), course("y")], versionNo: 1, regulation: "R23", branch: "cse" } }));
    expect(nodeOf(g, "sql").coverage).toMatchObject({ state: "STRONG", basis: "OFFICIAL", headline: "Course dbms · Semester 5" });
    expect(nodeOf(g, "joins").coverage).toMatchObject({ state: "PARTIAL", basis: "INFERRED" });
    expect(nodeOf(g, "stats").coverage).toMatchObject({ state: "NONE" }); // enough of the syllabus was analysed to say so
    expect(g.subjects[0]).toMatchObject({ courseId: "dbms" });
    expect(g.header.curriculum.analysed).toBe(true);
  });
});

describe("explainNode", () => {
  const dbms = course("dbms", { year: 3, links: [{ skillId: "s-joins", tier: "INFERRED", confidence: 0.9, level: "UNIT", unitId: "dbms-u1" }, { skillId: "s-joins", tier: "INFERRED", confidence: 0.9, level: "OUTCOME", outcomeId: "dbms-o1" }] });
  const ctx = makeContext(
    { curriculum: { state: "PUBLISHED", courses: [dbms, course("x"), course("y")], versionNo: 2, regulation: "R23", branch: "cse" }, resources: { bySkill: new Map([["s-joins", [resource({ id: "f1" }), resource({ id: "p1", tier: "PREMIUM", type: "COURSE", title: "Paid course" }), resource({ id: "a1", kind: "ARENA", title: "SQL ticket", difficulty: "medium", url: "/arena/challenges/domain" })]]]), byNode: new Map() } },
    { "s-joins": [{ kind: "ASSESSMENT", level: 20, observedAt: new Date("2026-10-01"), label: "Assessment" }] }
  );
  const joins = explainNode(ctx, "joins")!;
  it("explains the score with formula, evidence, target and its source", () => {
    expect(joins.score).toMatchObject({ level: 20, noEvidence: false, target: { level: 60 } });
    expect(joins.score!.evidence).toHaveLength(1);
    expect(joins.score!.formula.text).toMatch(/Each piece of evidence counts/);
    const sql = explainNode(ctx, "sql")!;
    expect(sql.score).toMatchObject({ level: null, noEvidence: true, target: { source: "Data Analyst career requirement" } });
  });
  it("shows where the college covers it, with units, outcomes (and their source), pages and timing", () => {
    expect(joins.college).toMatchObject({ state: "PARTIAL", basis: "INFERRED", curriculum: "PUBLISHED", message: null });
    expect(joins.college.items[0]).toMatchObject({ title: "Course dbms", timing: "UPCOMING", pages: { start: 5, end: 6 }, units: [{ no: 3, title: "Joins and subqueries" }], outcomes: [{ code: "D1", source: "INFERRED" }] });
  });
  it("splits resources into free and premium, and says plainly when there are none", () => {
    expect(joins.resources.free.map((r) => r.id)).toEqual(["f1"]);
    expect(joins.resources.premium.map((r) => r.id)).toEqual(["p1"]);
    expect(joins.practice.arena.map((r) => r.id)).toEqual(["a1"]);
    expect(explainNode(ctx, "stats")!.resources).toEqual({ free: [], premium: [], none: true });
  });
  it("offers a what-if only when the practice would really raise the level", () => {
    expect(joins.whatIf).toEqual([expect.objectContaining({ kind: "ARENA", resourceId: "a1", from: 20 })]);
    expect(joins.whatIf[0].to).toBe(25);
  });
  it("lists prerequisites and what it unlocks, and warns when skipping something others depend on", () => {
    expect(joins.prerequisites.map((p) => p.key)).toEqual(["sql"]);
    expect(joins.unlocks.map((p) => p.key)).toEqual(["windows"]);
    expect(joins.skipWarnings[0]).toMatch(/may make Window functions harder/);
  });
  it("explains a stage with the topics that build its number", () => {
    const stage = explainNode(ctx, "stage-a")!;
    expect(stage.score).toBeNull();
    expect(stage.rollup!.leaves.map((l) => l.key)).toEqual(["sql", "joins"]);
    expect(stage.rollup!.formula).toMatch(/Σ weight/);
  });
  it("explains the college message when there is no curriculum, and returns null for an unknown node", () => {
    expect(explainNode(makeContext(), "sql")!.college).toMatchObject({ state: "UNKNOWN", message: expect.stringMatching(/hasn't published a curriculum/) });
    expect(explainNode(ctx, "nope")).toBeNull();
  });
});

describe("explainReadiness and explainSubject", () => {
  const dbms = course("dbms", { links: [{ skillId: "s-sql", tier: "OFFICIAL", confidence: null, level: "COURSE", importance: "CORE" }] });
  const ctx = makeContext({ curriculum: { state: "PUBLISHED", courses: [dbms, course("x"), course("y")], versionNo: 1, regulation: null, branch: "cse" } });
  it("breaks readiness down by stage", () => {
    const r = explainReadiness(ctx);
    expect(r.stages.map((s) => s.key)).toEqual(["stage-a", "stage-b"]);
    expect(r.evidenceCoverage).toBe(0);
  });
  it("explains a subject's priority and rank, or null for an unknown one", () => {
    expect(explainSubject(ctx, "dbms")).toMatchObject({ rank: 1, of: 1, subject: { topics: [{ nodeKey: "sql" }] } });
    expect(explainSubject(ctx, "ghost")).toBeNull();
  });
});
