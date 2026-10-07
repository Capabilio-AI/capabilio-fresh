import { describe, expect, it } from "vitest";
import { MAX_DERIVED_OUTCOMES, groundOutcomes } from "./derive";

const SOURCE = "Unit 1: Relational model and SQL joins. Unit 2: Normalization up to BCNF. Lab: write queries using GROUP BY and subqueries.";
const o = (text: string, evidence: string[], bloom?: string) => ({ text, evidence, bloom });

describe("groundOutcomes", () => {
  it("keeps an outcome whose evidence is really in the course text", () => {
    const r = groundOutcomes([o("Write multi-table queries using SQL joins.", ["SQL joins"], "apply")], SOURCE);
    expect(r).toEqual([{ text: "Write multi-table queries using SQL joins.", bloom: "Apply", evidence: ["SQL joins"] }]);
  });
  it("drops an outcome with no grounded evidence: an invented outcome is never shown, even as inferred", () => {
    expect(groundOutcomes([o("Deploy machine learning models to production.", ["machine learning models"])], SOURCE)).toEqual([]);
  });
  it("keeps only the grounded evidence phrases", () => {
    const r = groundOutcomes([o("Normalize relations to BCNF form.", ["Normalization up to BCNF", "made up phrase"])], SOURCE);
    expect(r[0].evidence).toEqual(["Normalization up to BCNF"]);
  });
  it("removes duplicates, ignores unknown Bloom levels, and caps the count", () => {
    const dup = groundOutcomes([o("Write queries using GROUP BY clauses.", ["GROUP BY"], "nonsense"), o("write queries using group by clauses!", ["GROUP BY"])], SOURCE);
    expect(dup).toHaveLength(1);
    expect(dup[0].bloom).toBeNull();
    const many = Array.from({ length: 10 }, (_, i) => o(`Explain relational concept number ${i} clearly.`, ["Relational model"]));
    expect(groundOutcomes(many, SOURCE)).toHaveLength(MAX_DERIVED_OUTCOMES);
  });
});
