import { describe, expect, it } from "vitest";
import { TEMPLATE_REGISTRY, templatesPerArea, type RegisteredTemplate } from "./template-registry";

describe("template registry", () => {
  it("holds every source with at least one template, and every template names an area", () => {
    const bySource = new Map<string, number>();
    for (const t of TEMPLATE_REGISTRY) bySource.set(t.source, (bySource.get(t.source) ?? 0) + 1);
    for (const [source, n] of bySource) expect(n, source).toBeGreaterThan(0);
    expect(TEMPLATE_REGISTRY.filter((t) => t.areas.length === 0).map((t) => `${t.source}/${t.id}`)).toEqual([]);
  });
  it("has no duplicate id inside one source, and a known difficulty on every template", () => {
    const seen = new Set<string>();
    for (const t of TEMPLATE_REGISTRY) {
      const key = `${t.source}/${t.id}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
      expect(["easy", "medium", "hard", "expert"], key).toContain(t.difficulty);
    }
  });
  it("counts a template once in each area it lists", () => {
    const t = (id: string, areas: string[]): RegisteredTemplate => ({ source: "s", id, areas, difficulty: "easy", minLevel: "fresher" });
    const counts = templatesPerArea([t("a", ["x", "y"]), t("b", ["x"]), t("c", ["x", "x"])]);
    expect(counts.get("x")).toBe(3);
    expect(counts.get("y")).toBe(1);
  });
});
