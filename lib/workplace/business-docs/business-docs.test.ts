import { describe, expect, it } from "vitest";
import { validateBlueprint } from "@/lib/arena-roles/blueprint";
import { BUSINESS_ANALYST } from "@/lib/arena-roles/blueprints/business-analyst";
import { TOOLKIT } from "@/lib/arena-roles/toolkit/business-analyst";
import { validateToolkit } from "@/lib/arena-roles/toolkit/types";
import { businessDocsTool } from "@/lib/arena-workstations/tools/business-docs";
import { isGivenWhenThen, isMeasurable, isStory } from "./checks";
import { gradeBusinessDocs } from "./engine";
import { BUSINESS_DOCS_TEMPLATES, pickDocsTemplate } from "./templates";
import { BusinessDocsSubmissionSchema, type BusinessDocsSubmission, type BusinessDocsTemplate } from "./types";
import { makeRng } from "../rng";

const parse = (s: unknown) => BusinessDocsSubmissionSchema.parse(s);
const grade = (t: BusinessDocsTemplate, s: BusinessDocsSubmission) => gradeBusinessDocs(t.content, t.key, s);
const byId = (id: string) => BUSINESS_DOCS_TEMPLATES.find((t) => t.id === id)!;
const failed = (t: BusinessDocsTemplate, s: BusinessDocsSubmission) => grade(t, s).checks.filter((c) => !c.passed).map((c) => c.label);

describe("business docs templates", () => {
  for (const t of BUSINESS_DOCS_TEMPLATES) {
    it(`${t.id}: the solution passes every check and an empty document fails`, () => {
      const result = grade(t, parse(t.solution));
      expect(result.checks.filter((c) => !c.passed)).toEqual([]);
      expect(result.passed).toBe(true);
      expect(grade(t, parse({})).passed).toBe(false);
    });
  }

  it("covers three areas with an easy fresher ticket each and a medium one each", () => {
    for (const area of ["requirements", "process-mapping", "gap-analysis"]) {
      const inArea = BUSINESS_DOCS_TEMPLATES.filter((t) => t.areas.includes(area));
      expect(inArea.some((t) => t.difficulty === "easy" && t.minLevel === "fresher")).toBe(true);
      expect(inArea.some((t) => t.difficulty === "medium")).toBe(true);
    }
  });

  it("never puts the key in the student content", () => {
    for (const t of BUSINESS_DOCS_TEMPLATES) expect(JSON.stringify(t.content)).not.toMatch(/mustCover|contradiction"|raciExpect|requiredSteps/);
  });
});

describe("requirement checks", () => {
  const t = byId("ba-docs-warranty-backlog");
  const sol = parse(t.solution);

  it("rule helpers: story form, Given/When/Then, vague words need a number", () => {
    expect(isStory("As a customer, I want to track my claim, so that I stop calling support")).toBe(true);
    expect(isStory("Customer can track claims")).toBe(false);
    expect(isGivenWhenThen("Given a claim, when I open it, then I see the status")).toBe(true);
    expect(isGivenWhenThen("The status is shown")).toBe(false);
    expect(isMeasurable("Given a page, when it opens, then it is fast")).toBe(false);
    expect(isMeasurable("Given a page, when it opens, then it loads in 2 seconds")).toBe(true);
    expect(isMeasurable("Given a 4G phone, when it opens, then it feels quick")).toBe(false);
  });

  it("misses the planted contradiction and duplicate when they are not flagged", () => {
    expect(failed(t, { ...sol, issues: [] })).toEqual(["The contradiction between two statements is flagged", "The repeated request is flagged as a duplicate"]);
  });

  it("rejects false alarms and stories built on both sides of the contradiction", () => {
    expect(failed(t, { ...sol, issues: [...sol.issues, { kind: "duplicate", refs: ["N2", "N3"] }] })).toEqual(["Every flagged issue is real (no false alarms)"]);
    const both = { ...sol, stories: sol.stories.map((s, i) => (i === 0 ? { ...s, covers: [...s.covers, "N4", "N5"] } : s)) };
    expect(failed(t, both)).toContain("No story builds both sides of a contradiction");
  });

  it("fails a vague criterion, an uncovered requirement and an orphan test", () => {
    const vague = { ...sol, stories: sol.stories.map((s) => (s.id === "S4" ? { ...s, criteria: ["Given an invoice, when the customer uploads it, then it is easy"] } : s)) };
    expect(failed(t, vague)).toEqual(["Acceptance criteria are measurable (no vague word without a number)", "Vague requests are pinned to a number"]);
    const dropped = { ...sol, stories: sol.stories.filter((s) => s.id !== "S3"), tests: sol.tests.filter((x) => x.id !== "T3") };
    expect(failed(t, dropped)).toEqual(["Every stakeholder requirement is covered by a story", "Every requirement traces to at least one test"]);
    expect(failed(t, { ...sol, tests: [...sol.tests, { id: "T9", title: "x", covers: ["S99"] }] })).toEqual(["No orphan tests (each one traces to a story)"]);
  });

  it("citing a note without saying anything about it does not count as covering it", () => {
    const fake = { ...sol, stories: sol.stories.map((s) => (s.id === "S3" ? { ...s, text: "As a customer, I want a nice portal, so that I am happy", criteria: ["Given a claim, when I log in, then I see 1 page"] } : s)) };
    expect(failed(t, fake)).toContain("Every stakeholder requirement is covered by a story");
  });
});

describe("process and RACI checks", () => {
  const t = byId("ba-docs-damage-claim-raci");
  const sol = parse(t.solution);

  it("needs branches that rejoin, owners from the team and labelled decisions", () => {
    const split = { ...sol, process: [...sol.process.map((s) => (s.id === "explain" ? { ...s, next: [{ to: "end2", label: "" }] } : s)), { id: "end2", label: "Rejected", type: "end" as const, owner: "", next: [] }] };
    expect(failed(t, split)).toEqual(["The branches of every decision rejoin"]);
    const noOwner = { ...sol, process: sol.process.map((s) => (s.id === "inspect" ? { ...s, owner: "Someone" } : s)) };
    expect(failed(t, noOwner)).toEqual(["Every task and decision has an owner from the team list", "Every step the notes describe is on the map with the right owner"]);
    const unlabelled = { ...sol, process: sol.process.map((s) => (s.id === "amount" ? { ...s, next: s.next.map((n) => ({ ...n, label: "" })) } : s)) };
    expect(failed(t, unlabelled)).toEqual(["Only decisions branch, and each decision has at least two labelled branches"]);
  });

  it("catches an orphan step and a dead end", () => {
    const orphan = { ...sol, process: [...sol.process, { id: "x", label: "Audit", type: "task" as const, owner: "Claims team", next: [{ to: "end", label: "" }] }] };
    expect(failed(t, orphan)).toEqual(["Every step can be reached from the start"]);
    const dead = { ...sol, process: sol.process.map((s) => (s.id === "close" ? { ...s, next: [] } : s)) };
    expect(failed(t, dead)).toContain("Every step leads to an end, and ends lead nowhere");
  });

  it("needs exactly one Accountable per task and the decision rights from the notes", () => {
    const twoA = { ...sol, raci: { ...sol.raci, approve: { ...sol.raci.approve, "Claims team": "A" as const } } };
    expect(failed(t, twoA)).toEqual(["Exactly one Accountable (A) per task", "At least one Responsible (R) per task"]);
    const wrong = { ...sol, raci: { ...sol.raci, settle: { ...sol.raci.settle, "Claims team": "R" as const, "Finance controller": "A" as const } } };
    expect(failed(t, wrong)).toEqual(["The matrix matches the decision rights stated in the notes"]);
  });
});

describe("gap checks", () => {
  const t = byId("ba-docs-sim-kyc-gaps");
  const sol = parse(t.solution);
  it("needs every real gap and no gap for what already works", () => {
    expect(failed(t, { ...sol, gaps: sol.gaps.slice(0, 1) })).toEqual(["Every requirement the current process misses has a gap row"]);
    const extra = { ...sol, gaps: [...sol.gaps, { note: "N4", current: "a", target: "b", action: "c", owner: "Compliance" }] };
    expect(failed(t, extra)).toEqual(["No gap is raised for something the current process already does"]);
    const noOwner = { ...sol, gaps: sol.gaps.map((g) => ({ ...g, owner: "" })) };
    expect(failed(t, noOwner)).toEqual(["Every gap row states the current state, the target state, an action and an owner from the team"]);
  });
});

describe("business docs tool", () => {
  it("serves only the requested area and never leaks the key into the content", async () => {
    for (const areaKey of ["requirements", "process-mapping", "gap-analysis"]) {
      const c = await businessDocsTool.generate({ roleName: "Business Analyst", parentSkill: "Business Analysis", areaName: areaKey, areaKey, difficulty: "easy", avoidTitles: [], level: "fresher", ticketSeed: 7 });
      const t = BUSINESS_DOCS_TEMPLATES.find((x) => x.title === c.title)!;
      expect(t.areas).toContain(areaKey);
      expect(t.difficulty).toBe("easy");
      expect(JSON.stringify(c.content)).not.toContain("mustCover");
      const result = await businessDocsTool.grade(c.content, c.answer_key, businessDocsTool.submissionSchema.parse(t.solution));
      expect(result.passed).toBe(true);
    }
    await expect(businessDocsTool.generate({ roleName: "x", parentSkill: "x", areaName: "x", areaKey: "sql", difficulty: "easy", avoidTitles: [] })).rejects.toThrow();
  });

  it("prefers a title the user has not had", () => {
    const first = pickDocsTemplate({ areaKey: "requirements", difficulty: "easy", level: "fresher", rng: makeRng(1), avoidTitles: [] })!;
    const next = pickDocsTemplate({ areaKey: "requirements", difficulty: "easy", level: "fresher", rng: makeRng(1), avoidTitles: [first.title] })!;
    expect(next.title).not.toBe(first.title);
  });

  it("blueprint and toolkit are well-formed and agree with the tool", () => {
    expect(validateBlueprint(BUSINESS_ANALYST)).toEqual([]);
    expect(validateToolkit(TOOLKIT)).toEqual([]);
    for (const a of BUSINESS_ANALYST.areas.filter((x) => x.toolType === businessDocsTool.toolType)) {
      expect(a.generationVersion).toBe(businessDocsTool.generationVersion);
      expect(a.gradingVersion).toBe(businessDocsTool.gradingVersion);
    }
  });
});
