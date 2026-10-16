import { describe, expect, it } from "vitest";
import { nextMove, type MoveInput } from "./next-move";

const target = { skillId: "api", name: "API Design", progress: 0.3, areaKey: "rest-api" };
const base: MoveInput = { hasLevel: true, roleName: "Backend Developer", provenCount: 0, target, interviewCount: 0, interviewUnlocked: true, applicationCount: 0, topRole: { id: "o1", role: "Junior Backend Engineer", company: "Zoho", percent: 64 } };

describe("nextMove", () => {
  it("starts with the assessment, and says it earns nothing", () => {
    const m = nextMove({ ...base, hasLevel: false });
    expect(m.key).toBe("assess");
    expect(m.body).toMatch(/does not earn badges/);
    expect(m.cta.href).toBe("/assessment");
  });
  it("sends someone with no proof to Arena, on the skill that is closest, and shows the badge to unlock", () => {
    const m = nextMove(base);
    expect(m.key).toBe("first-proof");
    expect(m.title).toBe("Prove API Design");
    expect(m.cta.href).toBe("/arena/challenges/domain?focus=rest-api");
    expect(m.unlock?.skillId).toBe("api");
  });
  it("keeps asking for proof until three skills are proven", () => {
    expect(nextMove({ ...base, provenCount: 2 }).key).toBe("keep-proving");
    expect(nextMove({ ...base, provenCount: 2, target: null }).cta.href).toBe("/arena/challenges/domain");
  });
  it("then moves to interviews, or to plans when interviews are not included", () => {
    expect(nextMove({ ...base, provenCount: 3 })).toMatchObject({ key: "interview", cta: { href: "/dashboard/interview" } });
    expect(nextMove({ ...base, provenCount: 3, interviewUnlocked: false }).cta.href).toBe("/plans");
  });
  it("then suggests the best matching role, never inventing a match", () => {
    const m = nextMove({ ...base, provenCount: 3, interviewCount: 1 });
    expect(m).toMatchObject({ key: "apply", title: "Apply to Junior Backend Engineer" });
    expect(m.body).toContain("64% match");
    expect(nextMove({ ...base, provenCount: 3, interviewCount: 1, topRole: { id: "o", role: "QA", company: "X", percent: null } }).body).not.toMatch(/match with/);
    expect(nextMove({ ...base, provenCount: 3, interviewCount: 1, topRole: null }).cta.href).toBe("/launchpad");
  });
  it("keeps the proof going once applications are out", () => {
    expect(nextMove({ ...base, provenCount: 4, interviewCount: 2, applicationCount: 3 }).key).toBe("keep-proving");
  });
});
