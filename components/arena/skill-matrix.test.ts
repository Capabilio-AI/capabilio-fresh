import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MatrixRow } from "@/lib/capability/matrix";
import { SkillMatrix } from "./SkillMatrix";

const row = (over: Partial<MatrixRow>): MatrixRow => ({ skillId: "s", name: "SQL", level: 82, label: "Advanced", verified: true, confidence: 0.9, evidenceCount: 3, arenaPasses: 3, target: null, gap: null, ...over });
const html = (rows: MatrixRow[]) => renderToStaticMarkup(createElement(SkillMatrix, { rows, level: "junior" }));

describe("SkillMatrix", () => {
  it("shows each skill with its band, number and the evidence behind it", () => {
    const out = html([row({})]);
    expect(out).toContain("Your skill profile");
    expect(out).toContain("Tickets are matched to your experience: Junior");
    expect(out).toContain("SQL");
    expect(out).toContain("Advanced");
    expect(out).toContain("82");
    expect(out).toContain("3 Arena passes");
    expect(out).toContain("Verified by evidence");
  });

  it("shows an unmeasured skill as Not assessed with no number, and offers practice", () => {
    const out = html([row({ name: "Statistics", level: null, label: "Not assessed", verified: false, confidence: null, evidenceCount: 0, arenaPasses: 0, target: 60, practise: { areaKey: "statistics", areaName: "Statistics" } })]);
    expect(out).toContain("Not assessed");
    expect(out).toContain("not assessed");
    expect(out).toContain("/arena/challenges/domain?focus=statistics");
    expect(out).toContain("Practise Statistics");
  });

  it("says how far a skill is from the target, and stops offering practice once it is met", () => {
    const short = html([row({ level: 50, label: "Proficient", target: 70, gap: 20, practise: { areaKey: "sql", areaName: "SQL" } })]);
    expect(short).toContain("20 to reach the target of 70");
    expect(short).toContain("Practise SQL");
    const met = html([row({ level: 80, target: 70, gap: 0, practise: { areaKey: "sql", areaName: "SQL" } })]);
    expect(met).toContain("target 70 met");
    expect(met).not.toContain("Practise SQL");
  });

  it("explains an empty profile instead of showing zeros", () => {
    const out = html([]);
    expect(out).toContain("Nothing is measured yet");
  });
});
