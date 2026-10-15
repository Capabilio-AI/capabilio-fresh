import { describe, expect, it } from "vitest";
import { buildLessonPrompt, LESSON_SYSTEM } from "./lesson-prompts";

const topic = { title: "SQL Joins", description: "Combine rows from tables.", importance: "CORE", stage: "FOUNDATION" };

describe("lesson prompts", () => {
  it("names the topic, career and the right deliverable for each kind", () => {
    const theory = buildLessonPrompt(topic, "theory", "Data Analyst");
    const video = buildLessonPrompt(topic, "video", "Data Analyst");
    expect(theory).toContain("Career: Data Analyst");
    expect(theory).toContain("SQL Joins");
    expect(theory).toContain("written lesson");
    expect(video).toContain("narrated explainer");
    expect(video).toContain('"say"');
  });

  it("carries only the topic's facts, so one lesson can serve every learner", () => {
    const p = buildLessonPrompt(topic, "theory", "Data Analyst").toLowerCase();
    for (const personal of ["student's level", "score", "college", "syllabus"]) expect(p).not.toContain(personal);
  });

  it("forbids invented facts and markup", () => {
    expect(LESSON_SYSTEM).toMatch(/never invent/i);
    expect(LESSON_SYSTEM).toMatch(/no markdown/i);
  });
});
