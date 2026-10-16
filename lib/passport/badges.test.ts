import { describe, expect, it } from "vitest";
import type { EvidenceKind } from "@/lib/capability/read-model";
import { scoreSkill, type EvidenceInput } from "@/lib/roadmap-visual/capability";
import { badgeLevelFor, levelDates, passportSkill, passportSkills } from "./badges";

const NOW = new Date("2026-10-16T00:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const item = (kind: EvidenceKind, n: number, extra: Partial<EvidenceInput> = {}): EvidenceInput => ({ kind, level: kind === "ARENA" ? null : 80, observedAt: day(n), label: `${kind} ${n}`, difficulty: "medium", ...extra });
const skill = (id: string, items: EvidenceInput[]) => ({ skillId: id, name: id, lines: scoreSkill(items, NOW).lines });

describe("badges come from demonstrated work only", () => {
  it("a skill measured only by the assessment earns no badge, however high the score", () => {
    const s = passportSkill(skill("sql", [item("ASSESSMENT", 5, { level: 95 })]));
    expect(s.badge).toBeNull();
    expect(s.status).toBe("baseline");
    expect(s.baselineLevel).toBe(95);
    expect(s.baselineLabel).toBe("Advanced");
  });
  it("courses, certificates and self-declared skills do not earn badges either", () => {
    for (const kind of ["LEARNING_MODULE", "COURSE_PERFORMANCE", "CERTIFICATION", "SELF_DECLARED"] as EvidenceKind[]) expect(passportSkill(skill("x", [item(kind, 3, { level: 90 })])).badge).toBeNull();
  });
  it("one verified Arena task earns a provisional Foundation badge with a date", () => {
    const s = passportSkill(skill("api", [item("ARENA", 4)]));
    expect(s.badge?.level).toBe("Foundation");
    expect(s.badge?.provisional).toBe(true);
    expect(s.badge?.earnedAt).toBe(day(4).toISOString());
  });
  it("levels step up with more work: two tasks for Proficient, three for Advanced", () => {
    expect(passportSkill(skill("a", [item("ARENA", 9), item("ARENA", 5)])).badge?.level).toBe("Proficient");
    const adv = passportSkill(skill("a", [item("ARENA", 20), item("ARENA", 12), item("ARENA", 3, { difficulty: "hard" })]));
    expect(adv.badge?.level).toBe("Advanced");
    expect(adv.badge?.provisional).toBe(false);
  });
  it("records when each level was first reached", () => {
    const lines = scoreSkill([item("ARENA", 30), item("ARENA", 20), item("ARENA", 10)], NOW).lines;
    const dates = levelDates(lines);
    expect(dates.Foundation).toBe(day(30).toISOString());
    expect(dates.Proficient).toBe(day(20).toISOString());
    expect(dates.Advanced).toBe(day(10).toISOString());
  });
  it("a project or GitHub evidence counts as work; the baseline stays separate", () => {
    const s = passportSkill(skill("py", [item("ASSESSMENT", 40, { level: 70 }), item("PROJECT", 6, { level: 80 }), item("GITHUB", 2, { level: 75 })]));
    expect(s.badge?.level).toBe("Proficient");
    expect(s.baselineLevel).toBe(70);
    expect(s.practiceCount).toBe(2);
    expect(s.badge?.evidence.map((e) => e.kind).sort()).toEqual(["GITHUB", "PROJECT"]);
  });
  it("says what the next badge needs, and 'practising' when work is too old or too thin to count", () => {
    const s = passportSkill(skill("api", [item("ARENA", 4)]));
    expect(s.next).toEqual({ level: "Proficient", moreItems: 1, morePoints: expect.any(Number) });
    const thin = passportSkill(skill("api", [item("PROJECT", 5, { level: 10 })]));
    expect(thin.badge).toBeNull();
    expect(thin.status).toBe("practising");
  });
  it("an earned badge does not fade as the work ages, but the date of the last work is kept", () => {
    const old = passportSkill(skill("api", [item("ARENA", 900)]));
    expect(old.badge?.level).toBe("Foundation");
    expect(old.lastWorkAt).toBe(day(900).toISOString());
  });
  it("needs both enough points and enough pieces of work", () => {
    expect(badgeLevelFor(80, 1)).toBe("Foundation");
    expect(badgeLevelFor(80, 2)).toBe("Proficient");
    expect(badgeLevelFor(80, 3)).toBe("Advanced");
    expect(badgeLevelFor(19, 5)).toBeNull();
    expect(badgeLevelFor(null, 5)).toBeNull();
  });
  it("orders earned badges first, then practising, baseline and not assessed", () => {
    const out = passportSkills([skill("none", []), skill("base", [item("ASSESSMENT", 3)]), skill("earned", [item("ARENA", 3)]), skill("adv", [item("ARENA", 9), item("ARENA", 6), item("ARENA", 2, { difficulty: "hard" })])]);
    expect(out.map((s) => [s.name, s.status])).toEqual([["adv", "earned"], ["earned", "earned"], ["base", "baseline"], ["none", "not-assessed"]]);
  });
});
