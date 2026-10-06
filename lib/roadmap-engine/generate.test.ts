import { describe, expect, it } from "vitest";
import { generateRoadmap, nextBestAction } from "./generate";
import type { CareerRequirement, EngineInput, StudentSkillInput } from "./types";

const req = (skillId: string, importance: CareerRequirement["importance"], targetLevel: number, stage: CareerRequirement["stage"] = "JOB_READY", parentSkillId: string | null = null): CareerRequirement => ({ skillId, skillName: skillId.toUpperCase(), importance, targetLevel, stage, parentSkillId });
const v = (level: number): StudentSkillInput => ({ level, confidence: 0.7, verified: true, verifiedLevel: level, selfDeclaredLevel: null });
const base = (over: Partial<EngineInput> = {}): EngineInput => ({
  career: { id: "da", name: "Data Analyst" },
  requirements: [req("sql", "CRITICAL", 75, "FOUNDATION"), req("stats", "HIGH", 70, "FOUNDATION"), req("viz", "MEDIUM", 60)],
  courses: [
    { id: "dbms", title: "DBMS", year: 3, semester: 1, skills: [{ skillId: "sql", importance: "CORE", outcomeCount: 3 }], prerequisiteCourseIds: [] },
    { id: "ps", title: "Probability & Statistics", year: 2, semester: 2, skills: [{ skillId: "stats", importance: "CORE", outcomeCount: 2 }], prerequisiteCourseIds: [] },
    { id: "dm", title: "Data Mining", year: 4, semester: 1, skills: [{ skillId: "viz", importance: "SUPPORTING", outcomeCount: 1 }], prerequisiteCourseIds: [] },
  ],
  capability: { sql: v(38), stats: v(65) },
  hasAnyCapabilityData: true,
  position: { year: 3, semester: 1, totalYears: 4 },
  student: { id: "s1", institutionId: "i1" },
  catalogs: { learning: [], certifications: [], projects: [], arena: [] },
  ...over,
});

describe("generateRoadmap: the whole plan", () => {
  it("computes readiness, gaps, subjects and milestones from real inputs, with the mandatory note", () => {
    const p = generateRoadmap(base());
    expect(p.readiness).toBeGreaterThan(0);
    expect(p.readiness).toBeLessThan(100);
    expect(p.gaps.map((g) => [g.skillId, g.gap])).toEqual([["sql", 37], ["stats", 5], ["viz", 60]]);
    expect(p.subjects.map((s) => s.courseId)).toEqual(["dbms", "dm", "ps"]); // DBMS serves the biggest critical gap; stats is nearly met
    expect(p.subjects.find((s) => s.courseId === "ps")!.schedule).toBe("PAST");
    expect(p.mandatoryNote).toMatch(/All university subjects remain part of your academic curriculum/);
    expect(p.milestones.length).toBeGreaterThan(0);
  });
  it("the next best action names the real numbers and picks the highest-impact unblocked gap", () => {
    const a = generateRoadmap(base()).nextBestAction;
    expect(a.skillId).toBe("sql");
    expect(a.reason).toBe("Your SQL capability is 38 and your target is 75.");
    expect(a).toMatchObject({ kind: "COURSE", ref: { type: "course", id: "dbms" } }); // DBMS is this semester's course
  });
  it("says the catalogs are not configured when they aren't — and recommends nothing", () => {
    const p = generateRoadmap(base());
    expect(p.learning).toEqual([]);
    expect(p.learningNotConfigured.map((l) => l.message)).toEqual(expect.arrayContaining(["No learning resource configured yet for VIZ."]));
    expect(p.certificationNote).toBe("Certification recommendation not configured yet.");
    expect(p.projectNote).toBe("Project recommendations aren't configured yet.");
    expect(p.arenaNote).toMatch(/No Arena challenge is tagged/);
    expect(p.certifications).toEqual([]);
    expect(p.projects).toEqual([]);
    expect(p.arena).toEqual([]);
  });
  it("draws recommendations only from what is configured, for skills the curriculum does not fully cover", () => {
    const catalogs = {
      learning: [{ id: "l1", title: "Viz 101", provider: "P", url: null, levelFrom: 0, levelTo: 60, estimatedHours: 6, prerequisites: [], skillIds: ["viz"] }, { id: "l2", title: "SQL deep dive", provider: "P", url: null, levelFrom: 0, levelTo: 90, estimatedHours: 9, prerequisites: [], skillIds: ["sql"] }],
      certifications: [{ id: "c1", name: "PL-300", provider: "Microsoft", difficulty: null, url: null, cost: null, duration: null, eligibility: null, skillIds: ["viz"], careers: [{ careerId: "da", relevance: "RECOMMENDED" as const }] }],
      projects: [{ id: "p1", title: "Dashboard", description: "d", difficulty: "BEGINNER" as const, expectedEvidence: [], source: "CAPABILIO" as const, status: "ACTIVE" as const, institutionId: null, forStudentId: null, skillIds: ["viz"] }],
      arena: [{ id: "a1", title: "Chart it", difficulty: "easy", skillIds: ["viz"], active: true }],
    };
    const p = generateRoadmap(base({ catalogs }));
    expect(p.learning.map((l) => l.item.id)).toEqual(["l1"]); // SQL is STRONGLY covered by the curriculum, so no external course is suggested for it
    expect(p.certifications.map((c) => [c.cert.name, c.relevance])).toEqual([["PL-300", "RECOMMENDED"]]);
    expect(p.projects.map((x) => x.project.id)).toEqual(["p1"]);
    expect(p.arena.map((x) => x.challenge.id)).toEqual(["a1"]);
    expect(p.certificationNote).toBeNull();
    expect(p.milestones.some((m) => m.kind === "CERTIFICATION")).toBe(true);
  });
  it("with no capability data at all it still builds the plan, flags a baseline, and makes the assessment the first action", () => {
    const p = generateRoadmap(base({ capability: {}, hasAnyCapabilityData: false }));
    expect(p.baselineRecommended).toBe(true);
    expect(p.readiness).toBe(0);
    expect(p.gaps.every((g) => g.currentLevel === 0)).toBe(true);
    expect(p.nextBestAction).toMatchObject({ kind: "ASSESS", title: "Take the baseline assessment" });
    expect(p.subjects.length).toBeGreaterThan(0); // the curriculum side still works
  });
  it("when every target is met there is nothing left to chase", () => {
    const p = generateRoadmap(base({ capability: { sql: v(90), stats: v(90), viz: v(90) } }));
    expect(p.readiness).toBe(100);
    expect(p.subjects).toEqual([]);
    expect(p.nextBestAction.kind).toBe("NONE");
    expect(p.milestones.every((m) => m.kind !== "SKILL" || m.status === "COMPLETED")).toBe(true);
  });
  it("a self-declared skill is counted for less and called out in the action", () => {
    const claimed: StudentSkillInput = { level: 40, confidence: 0, verified: false, verifiedLevel: null, selfDeclaredLevel: 40 };
    const p = generateRoadmap(base({ capability: { sql: claimed, stats: v(65) } }));
    expect(p.gaps.find((g) => g.skillId === "sql")).toMatchObject({ selfDeclaredOnly: true, currentLevel: 20 });
    expect(p.nextBestAction.reason).toMatch(/nothing verifies it yet/);
  });
  it("is deterministic: same input, same plan", () => {
    expect(generateRoadmap(base())).toEqual(generateRoadmap(base()));
    const shuffled = base({ requirements: [...base().requirements].reverse(), courses: [...base().courses].reverse() });
    expect(generateRoadmap(shuffled)).toEqual(generateRoadmap(base()));
  });
});

describe("nextBestAction: choosing the action for the top gap", () => {
  const plan = generateRoadmap(base());
  const pick = (over: Partial<Parameters<typeof nextBestAction>[0]>) => nextBestAction({ gaps: plan.gaps, milestones: [], subjects: [], learning: [], arena: [], projects: [], hasAnyCapabilityData: true, ...over });
  it("prefers this semester's course, then a resource they can start now, then Arena, then a project, then an upcoming course", () => {
    const learning = [{ item: { id: "l", title: "SQL course" } as never, startsNow: true, reachesTarget: true, progress: 10, reason: "", skillId: "sql", skillName: "SQL" }];
    const arena = [{ challenge: { id: "a", title: "Query it", difficulty: "easy", skillIds: ["sql"], active: true }, coveredSkillIds: ["sql"] }];
    const projects = [{ project: { id: "p", title: "Report" } as never, coveredSkillIds: ["sql"], isAiRecommendation: false }];
    const sub = (schedule: "CURRENT" | "UPCOMING") => [{ courseId: "c", title: "DBMS", year: 3, semester: 1, score: 1, tier: "HIGH" as const, stars: 4, schedule, facts: { skillIds: ["sql"], skillNames: ["SQL"], outcomeCount: 1, gapPoints: 10 } }];
    expect(pick({ subjects: sub("CURRENT"), learning, arena, projects }).kind).toBe("COURSE");
    expect(pick({ learning, arena, projects }).kind).toBe("LEARN");
    expect(pick({ arena, projects }).kind).toBe("ARENA");
    expect(pick({ projects }).kind).toBe("PROJECT");
    expect(pick({ subjects: sub("UPCOMING") }).kind).toBe("COURSE");
    expect(pick({}).title).toBe("No resource configured yet for SQL");
  });
  it("skips a gap that is blocked by a prerequisite", () => {
    const blocked = pick({ milestones: [{ kind: "SKILL", refId: "sql", title: "", horizon: "NOW", status: "BLOCKED", reason: "", optionalExploration: true, blockedBySkillId: "x" }] });
    expect(blocked.skillId).toBe("viz");
  });
});
