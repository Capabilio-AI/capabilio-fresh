import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CareerProfile } from "@/lib/assess/career-profile";
import { displayRating } from "@/lib/assess/career-profile";
import { EloCardView, SkillsView } from "./ProfileViews";
import { CommonProgress } from "./CommonProgress";

const skill = (i: number, score: number | null) => ({ skillId: `id-${i}`, key: `K${i}`, name: `Skill ${i}`, category: "Data", importance: "HIGH" as const, targetLevel: 70, weight: 3, score, confidence: score === null ? ("INSUFFICIENT" as const) : ("MEDIUM" as const), evidenceCount: score === null ? 0 : 2 });
const profile: CareerProfile = {
  status: "PROFILE_READY", unlocked: true, role: { id: "r", key: "data-analyst", name: "Data Analyst" },
  elo: { rating: 458, fromAssessment: 58, fromArena: 0, events: 22, history: [] }, readiness: 63, coverage: 90,
  skills: [skill(1, 81), skill(2, 44), skill(3, null)], common: [{ section: "verbal_communication", label: "Communication", score: 82, confidence: "HIGH", correct: 8, total: 10 }],
  snapshotId: "s1", updatedAt: "2026-10-09",
};

describe("one profile, every surface", () => {
  it("the ELO card, the Skills section and the common bars all print the profile's own numbers", () => {
    const card = renderToStaticMarkup(h(EloCardView, { profile }));
    const skills = renderToStaticMarkup(h(SkillsView, { profile }));
    const common = renderToStaticMarkup(h(CommonProgress, { bars: profile.common! }));
    expect(card).toContain(">458<");
    expect(card).toContain("63%");
    for (const s of profile.skills) {
      expect(skills).toContain(s.name);
      expect(skills).toContain(`data-skill="${s.skillId}"`);
    }
    for (const s of profile.skills.filter((x) => x.score !== null)) expect(skills).toContain(`>${s.score}<`);
    expect(skills).toContain("Insufficient evidence"); // never a fake number for an unmeasured skill
    expect(common).toContain("82");
  });

  it("the popup shows the same rating the dashboard shows once the profile has loaded", () => {
    expect(displayRating(profile, 400)).toBe(458);
    expect(displayRating(null, 458)).toBe(458);
  });

  it("a locked profile renders no numbers at all", () => {
    const locked: CareerProfile = { ...profile, status: "ASSESSMENT_REQUIRED", unlocked: false, elo: null, readiness: null, skills: [], common: null };
    const html = (renderToStaticMarkup(h(EloCardView, { profile: locked })) + renderToStaticMarkup(h(SkillsView, { profile: locked }))).replace(/<[^>]*>/g, " ");
    expect(html).not.toMatch(/\d{2,}/);
    expect(html).toContain("Continue Assessment");
  });
});
