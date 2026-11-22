import { describe, expect, it } from "vitest";
import { cTrack } from "./c";
import { javaTrack } from "./java";
import { pythonTrack } from "./python";
import { cppTrack } from "./cpp";
import { sqlTrack } from "./sql";
import { htmlTrack } from "./html";
import { javascriptTrack } from "./javascript";
import { csharpTrack } from "./csharp";
import { allLessons, type Track } from "./types";
import { gradeLessonCheck, publicLesson } from "./lesson-check";

const tracks: Track[] = [cTrack, javaTrack, pythonTrack, cppTrack, sqlTrack, htmlTrack, javascriptTrack, csharpTrack];

describe("publicLesson", () => {
  it("never carries an answer or an explanation on a check question, for any lesson of any track", () => {
    for (const t of tracks) for (const l of allLessons(t)) {
      const p = publicLesson(l.lesson);
      expect(JSON.stringify(p), `${t.key}/${l.key}`).not.toContain("answerIndex");
      // a question holds only its text and its four options (the lesson's own prose may repeat an idea, that is not the check's answer)
      for (const c of p.check) expect(Object.keys(c).sort(), `${t.key}/${l.key}`).toEqual(["options", "question"]);
    }
  });
  it("keeps everything else a lesson page shows", () => {
    const l = allLessons(pythonTrack)[0].lesson;
    const p = publicLesson(l);
    expect(p.summary).toBe(l.summary);
    expect(p.sections).toEqual(l.sections);
    expect(p.check.map((c) => c.question)).toEqual(l.check.map((c) => c.question));
    expect(p.check.every((c) => c.options.length === 4)).toBe(true);
  });
});

describe("gradeLessonCheck", () => {
  const lesson = allLessons(pythonTrack)[0];
  const q = lesson.lesson.check[0];
  const wrong = (q.answerIndex + 1) % 4;
  it("marks a right answer and a wrong one, and reveals the answer and explanation", () => {
    expect(gradeLessonCheck(pythonTrack, lesson.key, 0, q.answerIndex)).toMatchObject({ correct: true, answerIndex: q.answerIndex, why: q.why });
    expect(gradeLessonCheck(pythonTrack, lesson.key, 0, wrong)).toMatchObject({ correct: false, answerIndex: q.answerIndex });
  });
  it("reports which module the lesson belongs to, so the caller can refuse a locked one", () => {
    const m = pythonTrack.modules.find((x) => x.lessons.some((l) => l.key === lesson.key))!;
    expect(gradeLessonCheck(pythonTrack, lesson.key, 0, 0)?.moduleKey).toBe(m.key);
  });
  it("returns null for a lesson or a question that does not exist", () => {
    expect(gradeLessonCheck(pythonTrack, "no-such-lesson", 0, 0)).toBeNull();
    expect(gradeLessonCheck(pythonTrack, lesson.key, 99, 0)).toBeNull();
  });
});
