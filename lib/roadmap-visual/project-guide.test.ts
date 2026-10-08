import { describe, expect, it } from "vitest";
import type { Resource } from "./graph-types";
import { ProjectGuide, buildGuidePrompt, findResource } from "./project-guide";

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
});
