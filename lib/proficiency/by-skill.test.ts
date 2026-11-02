import { describe, expect, it } from "vitest";
import { proficiencyBySkill, type Completion } from "./by-skill";

const links = [
  { roleKey: "data-analyst", areaKey: "sql", skillId: "SQL" },
  { roleKey: "data-analyst", areaKey: "debugging", skillId: "SQL" },
  { roleKey: "data-analyst", areaKey: "sql", skillId: "DA" },
  { roleKey: "data-analyst", areaKey: "python", skillId: "PY" },
];
const done = (id: string, areaKey: string, challengeId = "c-easy"): Completion => ({ attemptId: id, roleKey: "data-analyst", areaKey, challengeId });
const base = { difficultyByChallenge: { "c-easy": "easy", "c-med": "medium", "c-hard": "hard" }, submissionsByAttempt: {}, explainedAttempts: new Set<string>(), links, skillNames: { SQL: "SQL", DA: "Data Analysis", PY: "Python" } };

describe("proficiency by skill", () => {
  it("leaves out skills with no verified work", () => {
    expect(proficiencyBySkill({ ...base, completions: [] })).toEqual([]);
    expect(proficiencyBySkill({ ...base, completions: [done("a1", "python")] }).map((s) => s.skillName)).toEqual(["Python"]);
  });

  it("counts one pass toward every skill its area proves", () => {
    const names = proficiencyBySkill({ ...base, completions: [done("a1", "sql")] }).map((s) => s.skillName).sort();
    expect(names).toEqual(["Data Analysis", "SQL"]);
  });

  it("pools the areas that prove one skill, and knows the skill has two areas", () => {
    const completions = [done("a1", "sql"), done("a2", "sql"), done("a3", "debugging", "c-med"), done("a4", "debugging", "c-med"), done("a5", "sql", "c-med"), done("a6", "sql", "c-med")];
    const sql = proficiencyBySkill({ ...base, completions, explainedAttempts: new Set(["a3", "a5", "a6"]) }).find((s) => s.skillName === "SQL")!;
    expect(sql.proficiency.passes).toBe(6);
    expect(sql.proficiency.level).toBe(4); // medium work in two areas, 3 explained
  });

  it("takes difficulty, tries and explanations from the tasks, and defaults a missing difficulty to easy", () => {
    const r = proficiencyBySkill({ ...base, completions: [done("a1", "python", "unknown-challenge")], submissionsByAttempt: { a1: 7 } });
    expect(r[0].proficiency.level).toBe(1);
  });

  it("orders the strongest skill first", () => {
    const completions = [done("a1", "python"), done("a2", "sql"), done("a3", "sql"), done("a4", "sql")];
    const r = proficiencyBySkill({ ...base, completions });
    expect(r[0].proficiency.level).toBeGreaterThanOrEqual(r[r.length - 1].proficiency.level);
  });
});
