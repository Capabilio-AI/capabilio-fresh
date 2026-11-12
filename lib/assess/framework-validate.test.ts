import { describe, expect, it } from "vitest";
import type { RoleCritique } from "@/lib/ai/llm/prompts/role-critic.v1";
import type { RoleFramework } from "@/lib/ai/llm/prompts/role-framework.v2";
import { ASSESSMENT_LENGTH } from "@/lib/ai/llm/prompts/role-profile.v1";
import { applyCritique, budgets, isGenericSkill, normalizeSkill } from "./framework-validate";

type Tier = RoleFramework["skills"][number]["tier"];
const mk = (name: string, tier: Tier): RoleFramework["skills"][number] => ({ name, tier, category: "technical", description: `Do ${name} at entry level.`, rationale: `The role needs ${name}.`, assessmentType: "practical" });
const framework = (skills: RoleFramework["skills"]): RoleFramework => ({ roleSummary: "x".repeat(30), entryLevelExpectation: "y".repeat(30), responsibilities: ["one duty", "two duty", "three duty"], tools: [], skills });
const crit = (f: RoleFramework, over: Partial<RoleCritique> = {}, rel: Record<string, number> = {}): RoleCritique => ({
  roleIdentityMatches: true, confidence: 0.8, missingCoreSkills: [], concerns: [],
  skills: f.skills.map((s) => ({ name: s.name, relevance: rel[s.name] ?? 4, isGeneralEmployability: false, entryLevelAppropriate: true, comment: "" })), ...over,
});
const TIERS: Tier[] = ["CORE", "CORE", "CORE", "CORE", "CORE", "CORE", "INDUSTRY", "TOOL", "PRACTICAL", "SUPPORTING", "SUPPORTING", "ADVANCED"];
const good = () => framework(TIERS.map((t, i) => mk(`Skill ${i}`, t)));

describe("applyCritique", () => {
  it("accepts a reviewed framework and derives every number from the competency class", () => {
    const f = good();
    const r = applyCritique(f, crit(f));
    expect(r.ok).toBe(true);
    expect(r.skills).toHaveLength(12);
    const core = r.skills.filter((s) => s.tier === "CORE");
    expect(core.every((s) => s.importance === "CRITICAL" && s.assessmentWeight === 4 && s.targetLevel === 75)).toBe(true);
    expect(r.skills.find((s) => s.tier === "ADVANCED")).toMatchObject({ importance: "LOW", targetLevel: 40 });
    expect(r.skills.map((s) => s.tier)).toEqual([...r.skills.map((s) => s.tier)].sort((a, b) => ["CORE", "INDUSTRY", "TOOL", "PRACTICAL", "SUPPORTING", "ANALYTICAL", "ADVANCED"].indexOf(a) - ["CORE", "INDUSTRY", "TOOL", "PRACTICAL", "SUPPORTING", "ANALYTICAL", "ADVANCED"].indexOf(b)));
    expect(r.competencyConfidence).toBe(0.8);
  });

  it("drops skills the reviewer calls irrelevant, general employability, duplicates and unreviewed skills, and says why", () => {
    const f = framework([...good().skills, mk("Teamwork", "SUPPORTING"), mk("Skill 3", "SUPPORTING"), mk("Welding", "INDUSTRY"), mk("Never Reviewed", "TOOL")]);
    const c = crit(f, {}, { Welding: 1 });
    c.skills = c.skills.filter((s) => s.name !== "Never Reviewed");
    const r = applyCritique(f, c);
    const why = Object.fromEntries(r.dropped.map((d) => [d.name, d.reason]));
    expect(why["Teamwork"]).toMatch(/employability/);
    expect(why["Skill 3"]).toBe("duplicate");
    expect(why["Welding"]).toMatch(/not part of this role/);
    expect(why["Never Reviewed"]).toBe("not reviewed");
    expect(r.skills.map((s) => s.name)).not.toContain("Teamwork");
  });

  it("rejects a framework when the reviewer says it is a different role, confidence is low, or core skills are too few", () => {
    const f = good();
    expect(applyCritique(f, crit(f, { roleIdentityMatches: false })).ok).toBe(false);
    expect(applyCritique(f, crit(f, { confidence: 0.4 })).reasons.join(" ")).toMatch(/confidence/);
    const few = framework(TIERS.map((t, i) => mk(`Skill ${i}`, i < 3 ? "CORE" : t === "CORE" ? "INDUSTRY" : t)));
    expect(applyCritique(few, crit(few)).reasons.join(" ")).toMatch(/core skills/);
  });

  it("rejects a draft when too many of its skills were refused, instead of patching it", () => {
    const f = good();
    const r = applyCritique(f, crit(f, {}, { "Skill 6": 1, "Skill 7": 1, "Skill 8": 1, "Skill 9": 1, "Skill 10": 2 }));
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/rejected/);
  });

  it("keeps reviewer concerns as feedback without letting them alone block a sound framework", () => {
    const f = good();
    const r = applyCritique(f, crit(f, { concerns: ["could mention standards"] }));
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it("limits core to 8 by demoting the least central extras", () => {
    const f = framework([...TIERS.map((t, i) => mk(`Skill ${i}`, t)), mk("Core 7", "CORE"), mk("Core 8", "CORE"), mk("Core 9", "CORE")]);
    const r = applyCritique(f, crit(f, {}, { "Core 9": 3, "Core 8": 3 }));
    expect(r.skills.filter((s) => s.tier === "CORE")).toHaveLength(8);
    expect(r.skills.find((s) => s.name === "Core 9")?.tier).toBe("INDUSTRY");
  });
});

describe("reviewer name matching", () => {
  it("keeps a skill the reviewer echoed with a small change instead of dropping it as unreviewed", () => {
    const f = framework([...good().skills.slice(0, 11), mk("Prototype BMS Testing (practical)", "PRACTICAL")]);
    const c = crit(f);
    c.skills = c.skills.map((s) => (s.name.startsWith("Prototype") ? { ...s, name: "Prototype BMS Testing" } : s));
    const r = applyCritique(f, c);
    expect(r.dropped.find((d) => d.name.startsWith("Prototype"))).toBeUndefined();
    expect(r.skills.map((s) => s.name)).toContain("Prototype BMS Testing (practical)");
  });
});

describe("budgets", () => {
  it("always makes a full assessment possible, whatever the mix", () => {
    for (const mix of [
      ["CRITICAL", "CRITICAL", "CRITICAL", "CRITICAL", "CRITICAL", "CRITICAL", "HIGH", "HIGH", "HIGH", "MEDIUM", "MEDIUM", "LOW"],
      Array(16).fill("HIGH"), Array(14).fill("MEDIUM"), Array(10).fill("CRITICAL"),
    ] as ("CRITICAL" | "HIGH" | "MEDIUM" | "LOW")[][]) {
      const b = budgets(mix);
      expect(b.reduce((a, x) => a + x.min, 0)).toBeLessThanOrEqual(ASSESSMENT_LENGTH);
      expect(b.reduce((a, x) => a + Math.max(x.max, x.min, 1), 0)).toBeGreaterThanOrEqual(ASSESSMENT_LENGTH);
    }
  });
});

describe("generic skills", () => {
  it("recognises general employability by name, ignoring case and punctuation", () => {
    for (const n of ["Communication", "Technical Communication", "problem-solving", "Project Management", "MS Office"]) expect(isGenericSkill(n)).toBe(true);
    for (const n of ["Construction Project Management", "SQL", "GD&T", "Stakeholder Communication"]) expect(isGenericSkill(n)).toBe(false);
    expect(normalizeSkill("  GD&T / CAD  ")).toBe("gd t cad");
  });
});
