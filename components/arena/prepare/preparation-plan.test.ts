import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { matchJob } from "@/lib/launchpad/match";
import { buildPreparation } from "@/lib/launchpad/prepare";
import type { PreparationView } from "@/lib/launchpad/prepare-server";
import { PreparationPlan } from "./PreparationPlan";

const ids: Record<string, string> = { sql: "s1", excel: "s2", statistics: "s3", "power bi": "s4" };
const resolve = (t: string) => ids[t.trim().toLowerCase()] ?? null;
const levels = new Map<string, number>([["s1", 87], ["s2", 35]]);
const practise = new Map([["s3", { areaKey: "statistics", areaName: "Statistics" }]]);
const view = (skills: string[]): PreparationView => {
  const match = matchJob(skills, resolve, (id) => levels.get(id) ?? null);
  return { title: "Data Analyst, Acme", skills, match, preparation: buildPreparation(match, practise) };
};
const html = (skills: string[]) => renderToStaticMarkup(createElement(PreparationPlan, { view: view(skills) }));

describe("PreparationPlan", () => {
  it("shows the match, an honest estimate, and a step per gap with the right link", () => {
    const out = html(["SQL", "Excel", "Statistics", "Power BI"]);
    expect(out).toContain("Your preparation for Data Analyst, Acme");
    expect(out).toContain("% match today");
    expect(out).toContain("3 Arena tickets");
    expect(out).toContain("12 minutes each");
    expect(out).toContain("/arena/challenges/domain?focus=statistics");
    expect(out).toContain("Practise Statistics in Arena");
    expect(out).toContain("Learn it in SkillStudio");
    expect(out).toContain("Already ready:");
    expect(out).toContain("SQL (87)");
  });

  it("says what each gap needs without inventing a score for an unmeasured skill", () => {
    const out = html(["Statistics"]);
    expect(out).toContain("Not assessed yet");
    expect(out).toContain("the job needs about 60");
    expect(out).toContain("No evidence yet");
  });

  it("tells a ready user to apply, and names skills it could not place", () => {
    const ready = html(["SQL"]);
    expect(ready).toContain("ready to apply");
    expect(html(["SQL", "Quantum basket weaving"])).toContain("Not in our skill catalog yet, so not part of this plan: Quantum basket weaving");
  });

  it("explains when nothing could be compared instead of showing an empty plan", () => {
    expect(html(["Quantum basket weaving"])).toContain("none of the skills could be compared");
  });
});
