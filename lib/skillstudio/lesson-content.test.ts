import { describe, expect, it } from "vitest";
import { planExplainer, sceneAt, sceneSeconds, TheoryLesson, VideoScript } from "./lesson-content";

const q = { question: "Q?", options: ["a", "b", "c", "d"], answerIndex: 1, why: "because" };
const scene = (say: string) => ({ kind: "concept" as const, heading: "h", points: [], code: null, say });

describe("lesson content", () => {
  it("paces a scene by its narration with a floor", () => {
    expect(sceneSeconds("Short line here that is long enough")).toBe(4);
    const long = Array.from({ length: 50 }, () => "word").join(" "); // 50 words at 2.5 per second, plus air
    expect(sceneSeconds(long)).toBeCloseTo(20.8, 5);
  });

  it("lays scenes end to end and finds the scene for a frame", () => {
    const plan = planExplainer({ scenes: [scene("x".repeat(30)), scene("y".repeat(30)), scene("z".repeat(30))] }, 30);
    expect(plan.scenes[0].start).toBe(0);
    expect(plan.scenes[1].start).toBe(plan.scenes[0].frames);
    expect(plan.total).toBe(plan.scenes.reduce((n, s) => n + s.frames, 0));
    expect(sceneAt(plan, 0)).toBe(0);
    expect(sceneAt(plan, plan.scenes[1].start)).toBe(1);
    expect(sceneAt(plan, plan.total + 500)).toBe(2);
  });

  it("accepts a well-formed script and rejects one that is too thin", () => {
    const ok = { title: "t", scenes: Array.from({ length: 5 }, () => scene("This narration is long enough to be a sentence.")), check: [q, q] };
    expect(VideoScript.safeParse(ok).success).toBe(true);
    expect(VideoScript.safeParse({ ...ok, scenes: ok.scenes.slice(0, 2) }).success).toBe(false);
  });

  it("requires a real lesson: sections, takeaways and three checks", () => {
    const lesson = { summary: "s", sections: [{ heading: "a", paragraphs: ["p"] }, { heading: "b", paragraphs: ["p"] }], takeaways: ["1", "2", "3"], check: [q, q, q] };
    expect(TheoryLesson.safeParse(lesson).success).toBe(true);
    expect(TheoryLesson.safeParse({ ...lesson, check: [q] }).success).toBe(false);
  });
});
