import { describe, expect, it } from "vitest";
import { RoadmapAnswer } from "./model";
import { childSkillsFrom, qualityErrors, skillKeyFor, slug, toTemplateSpec } from "./normalize";

const answer = (over: Record<string, unknown> = {}) =>
  RoadmapAnswer.parse({
    title: "Cloud Engineer",
    newSkills: [],
    nodes: [
      { key: "s1", parent: null, type: "SPINE", title: "Foundation", description: "Learn the basics first.", stage: "FOUNDATION", side: "CENTER", order: 1 },
      { key: "g1", parent: "s1", type: "GROUP", title: "Networking", description: "How machines talk to each other.", stage: "FOUNDATION", side: "LEFT", order: 1 },
      { key: "t-anything", parent: "g1", type: "TOPIC", title: "Subnets", description: "Addressing and subnetting.", skill: "IP Addressing", importance: "CORE", target: 60, stage: "FOUNDATION", side: "LEFT", order: 1 },
      { key: "t-other", parent: "g1", type: "TOPIC", title: "DNS", description: "Names to addresses.", skill: "DNS", importance: "CORE", target: 60, stage: "FOUNDATION", side: "LEFT", order: 2 },
    ],
    edges: [{ from: "t-anything", to: "t-other", type: "PREREQUISITE" }],
    ...over,
  });

describe("toTemplateSpec", () => {
  it("rewrites topic keys to slug(skill) and follows them in edges, keeping group keys", () => {
    const spec = toTemplateSpec(answer(), { careerKey: "cloud-engineer", version: 2, model: "m" });
    expect(spec.nodes.map((n) => n.key)).toEqual(["s1", "g1", "ip-addressing", "dns"]);
    expect(spec.nodes[2].parent).toBe("g1");
    expect(spec.edges).toEqual([{ from: "ip-addressing", to: "dns", type: "PREREQUISITE" }]);
    expect(spec).toMatchObject({ career: "cloud-engineer", version: 2, provenance: { designedBy: "AI (m)" } });
  });
  it("never produces a topic key that collides with a group key", () => {
    const a = answer();
    a.nodes[2].skill = "Networking";
    const spec = toTemplateSpec(a, { careerKey: "c", version: 1, model: "m" });
    expect(new Set(spec.nodes.map((n) => n.key)).size).toBe(spec.nodes.length);
  });
});

describe("childSkillsFrom", () => {
  it("drops skills that already exist and duplicates, and keys the rest deterministically", () => {
    const a = answer({ newSkills: [
      { name: "Kubernetes Networking", parent: "Cloud", description: "How pods and services reach each other." },
      { name: "kubernetes  networking", parent: "Cloud", description: "Duplicate of the line above, differently spaced." },
      { name: "DNS", parent: "Computer Systems", description: "Already in the taxonomy under the same name." },
    ] });
    const out = childSkillsFrom(a, new Set(["DNS"]));
    expect(out).toEqual([{ key: "SKILL_KUBERNETES_NETWORKING", name: "Kubernetes Networking", parent: "Cloud", description: "How pods and services reach each other." }]);
  });
  it("derives keys and slugs", () => {
    expect(skillKeyFor("C++ & Memory!")).toBe("SKILL_C_MEMORY");
    expect(slug("Data Structures (Advanced)")).toBe("data-structures-advanced");
  });
});

describe("qualityErrors", () => {
  it("rejects a roadmap that is too small or too flat", () => {
    const spec = toTemplateSpec(answer(), { careerKey: "c", version: 1, model: "m" });
    const errs = qualityErrors(spec);
    expect(errs.some((e) => /Only 2 topics/.test(e))).toBe(true);
    expect(errs.some((e) => /1 stage/.test(e))).toBe(true);
  });
});
