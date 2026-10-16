import { describe, expect, it } from "vitest";
import { generateAiFrontend as generateAiDevops } from "./ai";

// Real model. Reports how often a fresh DevOps exercise survives its own checks and an independent solver, and that exercises differ.
const AREAS = ["html-semantics", "css-layout", "responsive-design", "accessibility", "forms", "frontend-debugging"];
const PER_AREA = 2;

describe("AI frontend exercises, live", () => {
  it("most generated exercises pass their own validation, and they are different", async () => {
    const titles: string[] = [];
    const reasons: string[] = [];
    let accepted = 0;
    for (const areaKey of AREAS) {
      for (let i = 0; i < PER_AREA; i++) {
        try {
          const d = await generateAiDevops({ roleName: "Frontend Developer", parentSkill: "Frontend Development", areaName: areaKey, areaKey, difficulty: i === 0 ? "easy" : "hard", avoidTitles: [...titles], ticketSeed: 300 + i * 11 + AREAS.indexOf(areaKey), level: "junior" });
          accepted++;
          titles.push(d.title);
          console.log(`ACCEPTED [${areaKey}/${i === 0 ? "easy" : "hard"}] ${d.title} :: ${d.content.files.map((f) => f.name).join(", ")} :: ${d.content.requirements.length} checks`);
        } catch (e) {
          reasons.push(`[${areaKey}] ${(e as Error).message.slice(0, 170)}`);
        }
      }
    }
    console.log(`accepted ${accepted}/${AREAS.length * PER_AREA}\nrejections:\n${reasons.join("\n")}`);
    expect(new Set(titles).size).toBe(titles.length);
    expect(accepted).toBeGreaterThanOrEqual(Math.ceil(AREAS.length * PER_AREA * 0.5));
  }, 900_000);
});
