import { describe, expect, it } from "vitest";
import { LEVELS } from "../level";
import { templateTiers } from "./pick";
import { BRIGHTCART_PG_TEMPLATES } from "./pg-index";
import { BRIGHTCART_SQL_TEMPLATES } from ".";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

/** (role area) pairs the database roles are given; every combination of difficulty and level must still serve a ticket. */
const PG_AREAS = ["queries", "programmability", "schema", "views", "security", "integrity", "performance", "maintenance", "transformation", "data-changes", "debugging"];

describe("ticket coverage", () => {
  for (const area of PG_AREAS) {
    it(`PostgreSQL area '${area}' always has something to serve, at every level and difficulty`, () => {
      for (const level of LEVELS) for (const difficulty of DIFFICULTIES) {
        const tiers = templateTiers(BRIGHTCART_PG_TEMPLATES, { difficulty, level, areaKey: area });
        expect(tiers.length, `${area}/${level}/${difficulty}`).toBeGreaterThan(0);
        expect(tiers.flat().every((t) => (t.areas ?? ["sql"]).includes(area))).toBe(true);
      }
    });
  }

  it("the Data Analyst SQL area always has something to serve", () => {
    for (const level of LEVELS) for (const difficulty of DIFFICULTIES) {
      expect(templateTiers(BRIGHTCART_SQL_TEMPLATES, { difficulty, level, areaKey: "sql" }).length).toBeGreaterThan(0);
    }
  });

  it("serves an exact fit when there is one, and the gentlest ticket first when a fresher has no exact fit", () => {
    const exact = templateTiers(BRIGHTCART_PG_TEMPLATES, { difficulty: "hard", level: "senior", areaKey: "security" })[0];
    expect(exact.every((t) => t.difficulty === "hard" && t.minLevel === "senior")).toBe(true);
    // every security ticket needs at least junior experience, so a fresher is offered the least demanding one
    const [widest] = templateTiers(BRIGHTCART_PG_TEMPLATES, { difficulty: "easy", level: "fresher", areaKey: "security" });
    expect(widest[0].minLevel).toBe("junior");
    expect(widest[0].difficulty).toBe("easy");
  });
});
