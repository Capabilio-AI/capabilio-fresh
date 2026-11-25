import { describe, expect, it } from "vitest";
import type { EvidenceKind } from "@/lib/capability/read-model";
import { scoreSkill, type EvidenceInput } from "@/lib/roadmap-visual/capability";
import { badgeLevelFor, levelDates, passportSkill, passportSkills } from "./badges";

const NOW = new Date("2026-10-16T00:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const item = (kind: EvidenceKind, n: number, extra: Partial<EvidenceInput> = {}): EvidenceInput => ({ kind, level: kind === "ARENA" ? null : 80, observedAt: day(n), label: `${kind} ${n}`, difficulty: "medium", ...extra });
const times = (n: number, make: (i: number) => EvidenceInput): EvidenceInput[] => Array.from({ length: n }, (_, i) => make(i));
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
  it("a few verified Arena tasks are not a badge yet: five pieces of work earn a provisional Foundation badge with a date", () => {
    expect(passportSkill(skill("api", [item("ARENA", 4)])).badge).toBeNull();
    const s = passportSkill(skill("api", times(5, (i) => item("ARENA", 10 - i))));
    expect(s.badge?.level).toBe("Foundation");
    expect(s.badge?.provisional).toBe(true);
    expect(s.badge?.earnedAt).toBe(day(6).toISOString());
  });
  it("levels step up with real depth: 5 pieces of work for Foundation, 15 for Proficient, 25 for Advanced", () => {
    expect(passportSkill(skill("a", times(15, (i) => item("ARENA", 30 - i)))).badge?.level).toBe("Proficient");
    const adv = passportSkill(skill("a", times(25, (i) => item("ARENA", 60 - i, { difficulty: "hard" }))));
    expect(adv.badge?.level).toBe("Advanced");
    expect(adv.badge?.provisional).toBe(false);
  });
  it("records when each level was first reached", () => {
    const lines = scoreSkill(times(25, (i) => item("ARENA", 100 - i * 2)), NOW).lines;
    const dates = levelDates(lines);
    expect(dates.Foundation).toBe(day(92).toISOString()); // the 5th piece of work
    expect(dates.Proficient).toBe(day(72).toISOString()); // the 15th
    expect(dates.Advanced).toBe(day(52).toISOString()); // the 25th
  });
  it("a project or GitHub evidence counts as work; the baseline stays separate", () => {
    const s = passportSkill(skill("py", [item("ASSESSMENT", 40, { level: 70 }), ...times(5, (i) => item(i % 2 ? "PROJECT" : "GITHUB", 6 - i, { level: 80 }))]));
    expect(s.badge?.level).toBe("Foundation");
    expect(s.baselineLevel).toBe(70);
    expect(s.practiceCount).toBe(5);
    expect([...new Set(s.badge?.evidence.filter((e) => e.kind !== "ASSESSMENT").map((e) => e.kind))].sort()).toEqual(["GITHUB", "PROJECT"]);
  });
  it("says what the next badge needs, and 'practising' when work is too old or too thin to count", () => {
    const s = passportSkill(skill("api", [item("ARENA", 4)]));
    expect(s.next).toEqual({ level: "Foundation", moreItems: 4, morePoints: expect.any(Number) });
    const thin = passportSkill(skill("api", [item("PROJECT", 5, { level: 10 })]));
    expect(thin.badge).toBeNull();
    expect(thin.status).toBe("practising");
  });
  it("an earned badge does not fade as the work ages, but the date of the last work is kept", () => {
    const old = passportSkill(skill("api", times(5, (i) => item("ARENA", 900 - i))));
    expect(old.badge?.level).toBe("Foundation");
    expect(old.lastWorkAt).toBe(day(896).toISOString());
  });
  it("needs both enough points and enough pieces of work", () => {
    expect(badgeLevelFor(80, 5)).toBe("Foundation");
    expect(badgeLevelFor(80, 15)).toBe("Proficient");
    expect(badgeLevelFor(80, 25)).toBe("Advanced");
    expect(badgeLevelFor(80, 4)).toBeNull();
    expect(badgeLevelFor(14, 30)).toBeNull();
    expect(badgeLevelFor(null, 5)).toBeNull();
  });
  it("orders earned badges first, then practising, baseline and not assessed", () => {
    const out = passportSkills([skill("none", []), skill("base", [item("ASSESSMENT", 3)]), skill("earned", times(5, (i) => item("ARENA", 10 - i))), skill("adv", times(25, (i) => item("ARENA", 50 - i, { difficulty: "hard" })))]);
    expect(out.map((s) => [s.name, s.status])).toEqual([["adv", "earned"], ["earned", "earned"], ["base", "baseline"], ["none", "not-assessed"]]);
  });
});
