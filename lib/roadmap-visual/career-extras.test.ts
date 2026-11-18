import { describe, expect, it } from "vitest";
import { careerExtras, MIN_CERT_SKILLS } from "./graph-build";
import type { GraphContext, Resource } from "./graph-types";

const res = (id: string, kind: Resource["kind"]): Resource => ({ id, kind, title: id, provider: null, url: null, type: null, tier: "PREMIUM", difficulty: null, hours: null, cost: null, note: null, description: null, evidence: [], skills: [] });
const topic = (key: string, skillId: string) => ({ key, type: "TOPIC", skillId, importance: "CORE" });

function ctxWith(links: Record<string, Resource[]>, skillIds: string[]): GraphContext {
  return { nodes: skillIds.map((s) => topic(`n-${s}`, s)), resources: { bySkill: new Map(Object.entries(links)), byNode: new Map() } } as unknown as GraphContext;
}

describe("careerExtras certifications", () => {
  const cka = res("cka", "CERTIFICATION");
  const da = res("da", "CERTIFICATION");
  const project = res("p1", "PROJECT");

  it("needs at least two of the role's own skills before a certification is shown", () => {
    expect(MIN_CERT_SKILLS).toBe(2);
    const one = careerExtras(ctxWith({ s1: [cka] }, ["s1", "s2", "s3"]));
    expect(one.certifications).toEqual([]);
    const two = careerExtras(ctxWith({ s1: [da], s2: [da] }, ["s1", "s2", "s3"]));
    expect(two.certifications.map((c) => c.id)).toEqual(["da"]);
  });

  it("does not apply the rule to projects", () => {
    expect(careerExtras(ctxWith({ s1: [project] }, ["s1"])).projects.map((p) => p.id)).toEqual(["p1"]);
  });
});
