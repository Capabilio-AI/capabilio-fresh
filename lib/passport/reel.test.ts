import { describe, expect, it } from "vitest";
import { planReel, reelTranscript, sceneAt, REEL_FPS, MAX_SECONDS, MIN_SECONDS, type ReelInput } from "./reel";

const base: ReelInput = { holder: { name: "Asha Rao", college: "VIT-AP", branch: "CSE", classOf: 2027, aspiringFor: "Data Analyst", passportNo: "CAP-SWIFT-FALCON-7K2Q" }, badges: [], elo: null, arenaPassed: 0, arena: [], interviews: null, proofs: [], github: null, fingerprint: "ab12-cd34-ef56-7890", measuredAt: null };
const many = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const rich: ReelInput = {
  ...base,
  badges: many(12, "Skill").map((name) => ({ name, level: "Proficient" as const, provisional: false })),
  elo: { rating: 640, history: [400, 480, 640] }, arenaPassed: 30,
  arena: many(10, "Challenge").map((title) => ({ title: `${title} about window functions and joins`, company: "Acme Analytics", area: "SQL" })),
  interviews: { count: 4, best: 88, average: 76 },
  proofs: many(10, "Project").map((title) => ({ title: `${title} campus dashboard`, kind: "project" })),
  github: { username: "asha", repositories: 18 },
};
const seconds = (n: ReelInput) => planReel(n).totalFrames / REEL_FPS;

describe("planReel", () => {
  it("a brand-new student gets an honest 'nothing yet' film, at least 30 seconds, with no invented evidence", () => {
    const plan = planReel(base);
    expect(plan.scenes.map((s) => s.kind)).toEqual(["intro", "start", "outro"]);
    expect(seconds(base)).toBeGreaterThanOrEqual(MIN_SECONDS);
  });
  it("adds a scene only when there is evidence behind it", () => {
    expect(planReel(rich).scenes.map((s) => s.kind)).toEqual(["intro", "badges", "momentum", "arena", "proofs", "interviews", "github", "outro"]);
    expect(planReel({ ...base, elo: { rating: 400, history: [400] } }).scenes.map((s) => s.kind)).not.toContain("momentum");
  });
  it("never runs past 90 seconds, however much evidence there is", () => {
    expect(seconds(rich)).toBeLessThanOrEqual(MAX_SECONDS);
  });
  it("more evidence makes a longer film", () => {
    expect(seconds(rich)).toBeGreaterThan(seconds({ ...base, badges: [{ name: "SQL", level: "Advanced", provisional: false }] }));
  });
  it("total frames is the sum of the scenes", () => {
    const p = planReel(rich);
    expect(p.totalFrames).toBe(p.scenes.reduce((n, s) => n + s.frames, 0));
  });
});

describe("narration", () => {
  it("says only what is true, and never reads the passport letters aloud", () => {
    const t = reelTranscript({ ...base, arenaPassed: 1 }).join(" ");
    expect(t).toContain("1 Arena challenge passed");
    expect(t).toContain("swift falcon");
    expect(t).not.toContain("7K2Q");
    expect(t).not.toContain("GitHub");
  });
});

describe("sceneAt", () => {
  it("finds the scene a frame falls in", () => {
    const plan = planReel(rich);
    expect(sceneAt(plan, 0)).toBe(0);
    expect(sceneAt(plan, plan.totalFrames - 1)).toBe(plan.scenes.length - 1);
  });
});
