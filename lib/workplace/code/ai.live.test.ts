import { describe, expect, it } from "vitest";
import { generateAiProblem } from "./ai";

// Real model, real sandbox. Reports how often a fresh exercise survives its own checks, and that exercises differ from one another.
const AREAS = ["fundamentals", "data-structures", "algorithms", "debugging"];
const PER_AREA = 3;

describe("AI programming exercises, live", () => {
  it("most generated exercises pass their own validation, and they are different", async () => {
    const titles: string[] = [];
    const reasons: string[] = [];
    let accepted = 0;
    for (const areaKey of AREAS) {
      for (let i = 0; i < PER_AREA; i++) {
        try {
          const d = await generateAiProblem({ roleName: "Programming Languages", parentSkill: "Programming", areaName: areaKey, areaKey, difficulty: i === 0 ? "easy" : i === 1 ? "medium" : "hard", avoidTitles: [...titles], ticketSeed: 1000 + i * 7 + AREAS.indexOf(areaKey), level: "junior" });
          accepted++;
          titles.push(d.title);
          console.log(`ACCEPTED [${areaKey}] ${d.title} -> ${d.content.fn}(${d.content.params.join(", ")}), ${d.content.cases.length} cases`);
        } catch (e) {
          reasons.push(`[${areaKey}] ${(e as Error).message.slice(0, 160)}`);
        }
      }
    }
    console.log(`accepted ${accepted}/${AREAS.length * PER_AREA}\nrejections:\n${reasons.join("\n")}`);
    expect(new Set(titles).size).toBe(titles.length);
    expect(accepted).toBeGreaterThanOrEqual(Math.ceil(AREAS.length * PER_AREA * 0.5));
  }, 600_000);
});
