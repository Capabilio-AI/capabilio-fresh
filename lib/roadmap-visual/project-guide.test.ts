import { describe, expect, it } from "vitest";
import type { Resource } from "./graph-types";
import { z } from "zod";
import { ProjectData, ProjectGuide, buildDataPrompt, buildGuidePrompt, findResource } from "./project-guide";

const r = { id: "11111111-1111-4111-8111-111111111111", kind: "PROJECT", title: "URL shortener", provider: null, url: null, type: null, tier: "FREE", difficulty: "EASY", hours: 8, cost: null, note: null, description: "Build a link shortener.", evidence: ["Repo link"], skills: ["REST APIs"] } satisfies Resource;

describe("project guide", () => {
  it("builds the prompt from stored fields", () => {
    const p = buildGuidePrompt(r, "Software Engineer");
    expect(p).toContain("URL shortener");
    expect(p).toContain("REST APIs");
  });
  it("finds a resource in either pool map", () => {
    expect(findResource({ bySkill: new Map(), byNode: new Map([["n", [r]]]) }, r.id)).toBe(r);
    expect(findResource({ bySkill: new Map(), byNode: new Map() }, r.id)).toBeNull();
  });
  it("rejects a guide with too few steps", () => {
    expect(ProjectGuide.safeParse({ overview: "x", outcome: "y", steps: [], skillsGained: [{ skill: "a", how: "b" }] }).success).toBe(false);
  });
  it("can be turned into JSON Schema for the AI layer (no transforms), the bug that broke every guide", () => {
    expect(() => z.toJSONSchema(ProjectGuide)).not.toThrow();
    expect(() => z.toJSONSchema(ProjectData)).not.toThrow();
  });
  it("accepts an older stored guide that lacks the newer fields", () => {
    const old = { overview: "o", outcome: "c", steps: [1, 2, 3, 4].map((n) => ({ title: `s${n}`, detail: "d", deliverable: "x" })), skillsGained: [{ skill: "a", how: "b" }] };
    const parsed = ProjectGuide.parse(old);
    expect(parsed.questions).toEqual([]);
    expect(parsed.checklist).toEqual([]);
  });
  it("asks for datasets in a prompt of its own", () => {
    expect(buildDataPrompt(r, "Data Analyst")).toContain('"datasets"');
    expect(buildGuidePrompt(r, "Data Analyst")).not.toContain('"datasets"');
  });
  it("parses a valid dataset description and rejects an invalid column name", () => {
    const ok = { datasets: [{ name: "orders", description: "d", rows: 50, columns: [{ name: "order_id", type: "id" }, { name: "amount", type: "number", min: 1, max: 9 }] }] };
    expect(ProjectData.safeParse(ok).success).toBe(true);
    expect(ProjectData.safeParse({ datasets: [{ ...ok.datasets[0], columns: [{ name: "1bad", type: "id" }, { name: "x", type: "id" }] }] }).success).toBe(false);
  });
});
