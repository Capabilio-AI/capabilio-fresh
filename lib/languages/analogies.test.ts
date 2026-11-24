import { describe, expect, it } from "vitest";
import { cTrack } from "./c";
import { pythonTrack } from "./python";
import { javaTrack } from "./java";
import { allLessons } from "./types";
import { ANALOGIES } from "./analogies";

describe("analogies", () => {
  it("every C lesson has one", () => {
    const missing = allLessons(cTrack).filter((l) => !ANALOGIES[`c/${l.key}`]).map((l) => l.key);
    expect(missing).toEqual([]);
  });
  it("every analogy belongs to a real lesson (no orphans)", () => {
    const real = new Set([cTrack, pythonTrack, javaTrack].flatMap((t) => allLessons(t).map((l) => `${t.key}/${l.key}`)));
    expect(Object.keys(ANALOGIES).filter((k) => !real.has(k))).toEqual([]);
  });
  it("each one says what matches what and, always, where the analogy stops being true", () => {
    for (const [key, a] of Object.entries(ANALOGIES)) {
      expect(a.icon.length, key).toBeGreaterThan(0);
      expect(a.title.length, key).toBeGreaterThan(2);
      expect(a.pairs.length, `${key}: pairs`).toBeGreaterThanOrEqual(3);
      expect(a.pairs.length, `${key}: pairs`).toBeLessThanOrEqual(4);
      for (const [everyday, code] of a.pairs) { expect(everyday.length, key).toBeGreaterThan(1); expect(code.length, key).toBeGreaterThan(1); }
      expect(a.differs.length, `${key}: differs`).toBeGreaterThan(30);
    }
  });
  it("stays short enough for a learner to read at a glance, in plain words", () => {
    for (const [key, a] of Object.entries(ANALOGIES)) {
      expect(a.text.length, `${key}: text`).toBeLessThanOrEqual(230);
      expect(a.differs.length, `${key}: differs`).toBeLessThanOrEqual(230);
      // no sentence over 30 words: these are read by students for whom English is a second language
      for (const sentence of `${a.text} ${a.differs}`.split(/(?<=[.!?])\s+/)) expect(sentence.split(/\s+/).length, `${key}: "${sentence}"`).toBeLessThanOrEqual(30);
    }
  });
});
