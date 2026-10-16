import { describe, expect, it } from "vitest";
import { generateAiMl } from "./ai";

// Real model. Reports how often a fresh scenario survives its own checks, and that scenarios differ from one another.
const AREAS = ["data-preparation", "model-training", "evaluation", "pipeline-debugging", "ml-fundamentals"];
const PER_AREA = 2;

describe("AI machine-learning scenarios, live", () => {
  it("most generated scenarios pass their own validation, and they are different", async () => {
    const titles: string[] = [];
    const headers: string[] = [];
    const reasons: string[] = [];
    let accepted = 0;
    for (const areaKey of AREAS) {
      for (let i = 0; i < PER_AREA; i++) {
        try {
          const d = await generateAiMl({ roleName: "AI / ML Engineer", parentSkill: "Machine Learning", areaName: areaKey, areaKey, difficulty: i === 0 ? "easy" : "hard", avoidTitles: [...titles], ticketSeed: 500 + i * 13 + AREAS.indexOf(areaKey), level: "junior" });
          accepted++;
          titles.push(d.title);
          headers.push(d.content.files[0]?.text.split("\n")[0] ?? d.content.starter.split("\n")[0]);
          console.log(`ACCEPTED [${areaKey}/${i === 0 ? "easy" : "hard"}] ${d.title} :: ${headers.at(-1)?.slice(0, 110)}`);
        } catch (e) {
          reasons.push(`[${areaKey}] ${(e as Error).message.slice(0, 160)}`);
        }
      }
    }
    console.log(`accepted ${accepted}/${AREAS.length * PER_AREA}\nrejections:\n${reasons.join("\n")}`);
    expect(new Set(titles).size).toBe(titles.length);
    expect(accepted).toBeGreaterThanOrEqual(Math.ceil(AREAS.length * PER_AREA * 0.5));
  }, 900_000);
});
