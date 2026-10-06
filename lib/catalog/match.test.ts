import { describe, expect, it } from "vitest";
import { recommendArena, recommendCertifications, recommendLearning, recommendProjects, type ArenaChallengeItem, type CertificationItem, type LearningItem, type ProjectItem } from "./match";

const learn = (id: string, skillIds: string[], from: number, to: number, hours: number | null = 10): LearningItem => ({ id, title: `Course ${id}`, provider: "P", url: null, levelFrom: from, levelTo: to, estimatedHours: hours, prerequisites: [], skillIds });
const cert = (id: string, skillIds: string[], careers: CertificationItem["careers"]): CertificationItem => ({ id, name: `Cert ${id}`, provider: "P", difficulty: null, url: null, cost: null, duration: null, eligibility: null, skillIds, careers });
const proj = (id: string, skillIds: string[], over: Partial<ProjectItem> = {}): ProjectItem => ({ id, title: `Project ${id}`, description: "d", difficulty: "BEGINNER", expectedEvidence: [], source: "CAPABILIO", status: "ACTIVE", institutionId: null, forStudentId: null, skillIds, ...over });

describe("recommendLearning", () => {
  const items = [learn("low", ["sql"], 0, 30), learn("basic", ["sql"], 0, 40), learn("mid", ["sql"], 30, 70), learn("adv", ["sql"], 60, 100), learn("other", ["py"], 0, 100), learn("all", ["sql"], 0, 100, 40)];
  it("only suggests resources that teach the skill and cover part of the gap between where the student is and the target", () => {
    const r = recommendLearning("sql", 35, 75, items, 10);
    expect(r.map((x) => x.item.id).sort()).toEqual(["adv", "all", "basic", "mid"]); // "low" ends below the student's level; "other" is a different skill
    expect(r.every((x) => x.item.skillIds.includes("sql"))).toBe(true);
  });
  it("puts what the student can start NOW first, then what reaches the target, then what moves them furthest", () => {
    const r = recommendLearning("sql", 35, 75, items, 10);
    expect(r.map((x) => x.item.id)).toEqual(["all", "mid", "basic", "adv"]);
    expect(r.map((x) => x.startsNow)).toEqual([true, true, true, false]);
    expect(r.map((x) => x.progress)).toEqual([40, 35, 5, 15]);
  });
  it("with equal progress, the shorter resource wins", () => {
    const r = recommendLearning("sql", 0, 50, [learn("long", ["sql"], 0, 50, 40), learn("short", ["sql"], 0, 50, 8)]);
    expect(r.map((x) => x.item.id)).toEqual(["short", "long"]);
  });
  it("says nothing when there is no gap, or nothing is configured for the skill", () => {
    expect(recommendLearning("sql", 80, 75, items)).toEqual([]);
    expect(recommendLearning("cooking", 0, 50, items)).toEqual([]);
    expect(recommendLearning("sql", 0, 50, [])).toEqual([]);
  });
  it("explains itself with the real numbers", () => {
    const r = recommendLearning("sql", 35, 75, [learn("mid", ["sql"], 30, 70)]);
    expect(r[0].reason).toMatch(/30.*70/);
    expect(r[0].reason).toMatch(/35/);
    expect(r[0].reason).toMatch(/75/);
  });
  it("respects the limit and is deterministic", () => {
    expect(recommendLearning("sql", 0, 100, items, 2)).toHaveLength(2);
    expect(recommendLearning("sql", 0, 100, [...items].reverse())).toEqual(recommendLearning("sql", 0, 100, items));
  });
});

describe("recommendCertifications", () => {
  const certs = [
    cert("opt", ["sql"], [{ careerId: "da", relevance: "OPTIONAL" }]),
    cert("rec2", ["sql", "stats"], [{ careerId: "da", relevance: "RECOMMENDED" }]),
    cert("req", ["stats"], [{ careerId: "da", relevance: "REQUIRED" }]),
    cert("other-career", ["sql"], [{ careerId: "se", relevance: "REQUIRED" }]),
    cert("no-overlap", ["py"], [{ careerId: "da", relevance: "REQUIRED" }]),
  ];
  it("only certifications configured for THIS career that cover a skill the student still needs", () => {
    expect(recommendCertifications("da", ["sql", "stats"], certs).map((c) => c.cert.id)).toEqual(["req", "rec2", "opt"]);
  });
  it("the REQUIRED / RECOMMENDED / OPTIONAL label is the one stored for that career — never inferred", () => {
    const r = recommendCertifications("da", ["sql"], certs);
    expect(r.map((c) => [c.cert.id, c.relevance])).toEqual([["rec2", "RECOMMENDED"], ["opt", "OPTIONAL"]]);
  });
  it("lists which of the student's gaps each one would address", () => {
    expect(recommendCertifications("da", ["sql", "stats", "py"], certs).find((c) => c.cert.id === "rec2")!.coveredSkillIds.sort()).toEqual(["sql", "stats"]);
  });
  it("returns nothing with no gaps or no career", () => {
    expect(recommendCertifications("da", [], certs)).toEqual([]);
    expect(recommendCertifications(null, ["sql"], certs)).toEqual([]);
  });
});

describe("recommendProjects", () => {
  const ctx = { studentId: "s1", institutionId: "i1" };
  it("offers live general projects, and only that college's own projects", () => {
    const projects = [proj("gen", ["sql"]), proj("mine", ["sql"], { source: "COLLEGE", institutionId: "i1" }), proj("theirs", ["sql"], { source: "COLLEGE", institutionId: "i2" }), proj("mentor", ["sql"], { source: "MENTOR" })];
    expect(recommendProjects(["sql"], projects, ctx).map((p) => p.project.id).sort()).toEqual(["gen", "mentor", "mine"]);
  });
  it("never offers drafts or archived projects", () => {
    expect(recommendProjects(["sql"], [proj("d", ["sql"], { status: "DRAFT" }), proj("a", ["sql"], { status: "ARCHIVED" })], ctx)).toEqual([]);
  });
  it("an AI-generated recommendation is shown only to the student it was made for, and is marked as a recommendation", () => {
    const ai = proj("ai", ["sql"], { source: "AI_GENERATED", status: "RECOMMENDATION", forStudentId: "s1" });
    const r = recommendProjects(["sql"], [ai], ctx);
    expect(r).toHaveLength(1);
    expect(r[0].isAiRecommendation).toBe(true);
    expect(recommendProjects(["sql"], [ai], { ...ctx, studentId: "s2" })).toEqual([]);
    expect(recommendProjects(["sql"], [{ ...ai, status: "ACTIVE" }], ctx)).toEqual([]); // an AI project can never act as a live catalog entry
  });
  it("ranks by how many of the student's gaps it addresses, then easier first, and can cap difficulty", () => {
    const projects = [proj("hard2", ["a", "b"], { difficulty: "ADVANCED" }), proj("easy1", ["a"]), proj("mid2", ["a", "b"], { difficulty: "INTERMEDIATE" })];
    expect(recommendProjects(["a", "b"], projects, ctx).map((p) => p.project.id)).toEqual(["mid2", "hard2", "easy1"]);
    expect(recommendProjects(["a", "b"], projects, { ...ctx, maxDifficulty: "INTERMEDIATE" }).map((p) => p.project.id)).toEqual(["mid2", "easy1"]);
  });
  it("needs overlap with a gap skill", () => {
    expect(recommendProjects(["x"], [proj("p", ["sql"])], ctx)).toEqual([]);
    expect(recommendProjects([], [proj("p", ["sql"])], ctx)).toEqual([]);
  });
});

describe("recommendArena", () => {
  const ch = (id: string, skillIds: string[], difficulty: string, active = true): ArenaChallengeItem => ({ id, title: id, difficulty, skillIds, active });
  it("picks active challenges tagged with a gap skill, nearest the wanted difficulty first", () => {
    const list = [ch("e", ["sql"], "easy"), ch("m", ["sql"], "medium"), ch("h", ["sql"], "hard"), ch("off", ["sql"], "medium", false), ch("other", ["py"], "medium")];
    expect(recommendArena(["sql"], list, "medium").map((c) => c.challenge.id)).toEqual(["m", "e", "h"]);
  });
  it("returns nothing when no challenge is tagged with the gap skills", () => {
    expect(recommendArena(["cooking"], [ch("e", ["sql"], "easy")], "easy")).toEqual([]);
  });
});
