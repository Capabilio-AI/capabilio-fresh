import { describe, expect, it } from "vitest";
import { deriveRequirements, type TopicNode } from "./requirements";

const node = (n: Partial<TopicNode> & { skillId: string }): TopicNode => ({ importance: "CORE", stage: "CORE", targetLevel: 60, order: 0, ...n });

describe("deriveRequirements", () => {
  it("turns roadmap topics into weighted requirements", () => {
    const [r] = deriveRequirements([node({ skillId: "a", importance: "CORE", stage: "FOUNDATION", targetLevel: 70 })]);
    expect(r).toMatchObject({ skill_id: "a", importance: "CRITICAL", target_level: 70, required_by_stage: "FOUNDATION", assessment_weight: 4, min_questions: 2, max_questions: 4 });
  });
  it("maps importance and stage down the ladder", () => {
    const rows = deriveRequirements([
      node({ skillId: "core", importance: "CORE", stage: "CORE" }),
      node({ skillId: "rec", importance: "RECOMMENDED", stage: "SPECIALIZATION" }),
      node({ skillId: "opt", importance: "OPTIONAL", stage: "JOB_READY" }),
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.skill_id, r]));
    expect(by.core).toMatchObject({ importance: "HIGH", required_by_stage: "INTERMEDIATE", assessment_weight: 3, min_questions: 1, max_questions: 3 });
    expect(by.rec).toMatchObject({ importance: "MEDIUM", required_by_stage: "JOB_READY", assessment_weight: 2, max_questions: 2 });
    expect(by.opt).toMatchObject({ importance: "LOW", required_by_stage: "JOB_READY", assessment_weight: 1, min_questions: 0, max_questions: 1 });
  });
  it("uses a skill once, keeping its strongest topic", () => {
    const rows = deriveRequirements([node({ skillId: "a", importance: "OPTIONAL" }), node({ skillId: "a", importance: "CORE", stage: "FOUNDATION" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].importance).toBe("CRITICAL");
  });
  it("keeps every skill the role needs, however many, most important first", () => {
    const nodes = Array.from({ length: 37 }, (_, i) => node({ skillId: `s${i}`, importance: i === 30 ? "CORE" : "OPTIONAL", stage: i === 30 ? "FOUNDATION" : "JOB_READY", order: i }));
    const rows = deriveRequirements(nodes);
    expect(rows).toHaveLength(37);
    expect(rows[0].skill_id).toBe("s30");
  });
  it("is empty for a roadmap with no topics", () => {
    expect(deriveRequirements([])).toEqual([]);
  });
});
