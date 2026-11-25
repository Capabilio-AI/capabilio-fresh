import { describe, expect, it } from "vitest";
import { nextProof } from "./next-proof";
import { cTrack } from "./c";

const done = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, { correct: 1, total: 1, completedAt: "x" }]));

describe("nextProof", () => {
  it("points a fresh student at the first step's Arena proof", () => {
    const first = cTrack.modules[0].lessons[0];
    expect(nextProof(cTrack, {}, {})).toMatchObject({ kind: "step", href: `/arena/prove/c/${first.key}` });
  });
  it("moves to the next step once one is done", () => {
    const [a, b] = cTrack.modules[0].lessons;
    expect(nextProof(cTrack, done([a.key]), {})?.href).toBe(`/arena/prove/c/${b.key}`);
  });
  it("sends a student whose module steps are all done to that module's test", () => {
    const keys = cTrack.modules[0].lessons.map((l) => l.key);
    expect(nextProof(cTrack, done(keys), {})).toMatchObject({ kind: "module", href: `/skillstudio/courses/c/module/${cTrack.modules[0].key}` });
  });
});
