import { describe, expect, it, vi } from "vitest";
import { RoadmapAnswer } from "./model";
import { draftRoadmap, type Taxonomy } from "./draft";

const SKILLS = Array.from({ length: 24 }, (_, i) => `Skill ${i + 1}`);
const taxonomy: Taxonomy = { existing: [...SKILLS, "Cloud"].map((name) => ({ key: null, name, status: "active" as const, category: "Cloud" })), aliases: new Set() };

function good(over: { skills?: string[]; newSkills?: unknown[] } = {}) {
  const skills = over.skills ?? SKILLS;
  const spines = [["FOUNDATION", "found"], ["CORE", "core"], ["SPECIALIZATION", "spec"]] as const;
  const nodes: unknown[] = [];
  spines.forEach(([stage, k], i) => {
    nodes.push({ key: `s-${k}`, parent: null, type: "SPINE", title: stage, description: "A stage of the roadmap.", stage, side: "CENTER", order: i + 1 });
    nodes.push({ key: `g-${k}`, parent: `s-${k}`, type: "GROUP", title: `${stage} area`, description: "A group of related topics.", stage, side: i % 2 ? "RIGHT" : "LEFT", order: 1 });
  });
  skills.forEach((skill, i) => {
    const [stage, k] = spines[Math.min(2, Math.floor(i / 8))];
    nodes.push({ key: `t${i}`, parent: `g-${k}`, type: "TOPIC", title: skill, description: `Learn ${skill} well.`, skill, importance: "CORE", target: 60, stage, side: Math.floor(i / 8) % 2 ? "RIGHT" : "LEFT", order: i + 1 });
  });
  return RoadmapAnswer.parse({ title: "Cloud Engineer", newSkills: over.newSkills ?? [], nodes, edges: [] });
}

const input = (ask: Parameters<typeof draftRoadmap>[0]["ask"]) => ({ careerKey: "cloud-engineer", careerId: "c1", version: 1, taxonomy, ask });

describe("draftRoadmap", () => {
  it("accepts a valid answer first time and keys topics by skill", async () => {
    const ask = vi.fn().mockResolvedValue({ answer: good(), model: "m" });
    const out = await draftRoadmap(input(ask));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.draft.rounds).toBe(1);
      expect(out.draft.spec.nodes.some((n) => n.key === "skill-1")).toBe(true);
    }
  });
  it("feeds the exact problems back and accepts the corrected answer", async () => {
    const bad = good({ skills: [...SKILLS.slice(0, 23), "A skill that does not exist"] });
    const ask = vi.fn().mockResolvedValueOnce({ answer: bad, model: "m" }).mockResolvedValueOnce({ answer: good(), model: "m" });
    const out = await draftRoadmap(input(ask));
    expect(out.ok && out.draft.rounds).toBe(2);
    expect(ask.mock.calls[1][0].join(" ")).toMatch(/does not exist in the taxonomy/);
  });
  it("lets the model add a skill under an existing parent and then use it", async () => {
    const answer = good({ skills: [...SKILLS.slice(0, 23), "Kubernetes Networking"], newSkills: [{ name: "Kubernetes Networking", parent: "Cloud", description: "How pods and services reach each other." }] });
    const out = await draftRoadmap(input(vi.fn().mockResolvedValue({ answer, model: "m" })));
    expect(out.ok && out.draft.newSkills.map((s) => s.key)).toEqual(["SKILL_KUBERNETES_NETWORKING"]);
  });
  it("rejects a new skill whose parent is not an existing skill, and gives up after three rounds", async () => {
    const answer = good({ skills: [...SKILLS.slice(0, 23), "Edge Mesh"], newSkills: [{ name: "Edge Mesh", parent: "No Such Parent", description: "A skill with an invented parent skill." }] });
    const ask = vi.fn().mockResolvedValue({ answer, model: "m" });
    const out = await draftRoadmap(input(ask));
    expect(out.ok).toBe(false);
    expect(ask).toHaveBeenCalledTimes(3);
    if (!out.ok) expect(out.errors.join(" ")).toMatch(/not an existing active skill/);
  });
  it("rejects a roadmap that is too small", async () => {
    const out = await draftRoadmap(input(vi.fn().mockResolvedValue({ answer: good({ skills: SKILLS.slice(0, 5) }), model: "m" })));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.join(" ")).toMatch(/at least 20/);
  });
});
