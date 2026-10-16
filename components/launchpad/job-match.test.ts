import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { matchJob } from "@/lib/launchpad/match";
import { JobMatch } from "./JobMatch";

const ids: Record<string, string> = { sql: "s1", excel: "s2", statistics: "s3" };
const resolve = (t: string) => ids[t.trim().toLowerCase()] ?? null;
const levels = new Map<string, number>([["s1", 87], ["s2", 30]]);
const practise = new Map([["s3", { areaKey: "statistics", areaName: "Statistics" }]]);
const render = (skills: string[]) => renderToStaticMarkup(createElement(JobMatch, { match: matchJob(skills, resolve, (id) => levels.get(id) ?? null), practise }));

describe("JobMatch", () => {
  it("gives the percentage and says what it is based on", () => {
    const out = render(["SQL", "Excel"]);
    expect(out).toContain("75% match");
    expect(out).toContain("Based on 2 of 2 skills you have been measured on");
    expect(out).toContain("Ready · level 87");
    expect(out).toContain("Building · level 30 of 60");
  });

  it("does not turn a skill nobody measured into a low score, and links the gap to Arena", () => {
    const out = render(["SQL", "Statistics"]);
    expect(out).toContain("Not assessed yet");
    expect(out).toContain("Based on 1 of 2 skills you have been measured on");
    expect(out).toContain("/arena/challenges/domain?focus=statistics");
    expect(out).toContain("practise Statistics in Arena");
  });

  it("says plainly when there is no evidence at all, instead of 0%", () => {
    const out = render(["Statistics"]);
    expect(out).toContain("No evidence yet");
    expect(out).not.toContain("0% match");
  });

  it("reports a job skill it cannot place, and leaves it out of the number", () => {
    const out = render(["SQL", "Quantum basket weaving"]);
    expect(out).toContain("100% match");
    expect(out).toContain("Not in the skill catalog yet");
  });

  it("sends a gap with no Arena area to SkillStudio, and a job with no skills shows nothing", () => {
    expect(render(["Excel"])).toContain("learn it in SkillStudio");
    expect(render([])).toBe("");
  });
});
