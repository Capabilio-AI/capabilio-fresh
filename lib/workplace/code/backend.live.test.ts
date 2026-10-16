import { describe, expect, it } from "vitest";
import { generateAiProblem } from "./ai";

// Real model. Backend exercises: how often a fresh one survives its own checks (solution, wrong solution, independent solver), and that they differ.
const AREAS = ["rest-api", "auth-and-security", "data-and-state", "error-handling", "backend-debugging"];
const PER_AREA = 2;

describe("AI backend exercises, live", () => {
  it("most generated exercises pass their own validation, and they are different", async () => {
    const titles: string[] = [];
    const reasons: string[] = [];
    let accepted = 0;
    for (const areaKey of AREAS) {
      for (let i = 0; i < PER_AREA; i++) {
        let hint: string | undefined;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
          const d = await generateAiProblem({ roleName: "Backend Developer", roleKey: "backend-developer", parentSkill: "Backend Development", areaName: areaKey, areaKey, difficulty: i === 0 ? "easy" : "hard", avoidTitles: [...titles], ticketSeed: 700 + i * 17 + AREAS.indexOf(areaKey), level: "junior" }, undefined, hint);
          accepted++;
          titles.push(d.title);
          console.log(`ACCEPTED [${areaKey}/${i === 0 ? "easy" : "hard"}] attempt ${attempt}: ${d.title} -> ${d.content.fn}(${d.content.params.join(", ")}), ${d.content.cases.length} cases`);
          break;
        } catch (e) {
          hint = (e as Error).message.slice(0, 200);
          if (attempt === 2) reasons.push(`[${areaKey}] ${hint}`);
        }
        }
      }
    }
    console.log(`accepted ${accepted}/${AREAS.length * PER_AREA}\nrejections:\n${reasons.join("\n")}`);
    expect(new Set(titles).size).toBe(titles.length);
    expect(accepted).toBeGreaterThanOrEqual(Math.ceil(AREAS.length * PER_AREA * 0.5));
  }, 900_000);
});
