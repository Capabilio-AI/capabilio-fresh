import { describe, expect, it } from "vitest";
import { htmlTrack } from "./html";
import { judgePage } from "./html-judge";
import { isHtmlChallenge, type HtmlChallenge } from "./types";

const challenges = htmlTrack.modules.flatMap((m) => (m.challenge && isHtmlChallenge(m.challenge) ? [[m.key, m.challenge] as const] : []));

describe("HTML and CSS module problems", () => {
  it("cover every HTML & CSS module", () => expect(challenges.map(([k]) => k)).toEqual(htmlTrack.modules.map((m) => m.key)));

  it.each(challenges)("%s: the reference page meets every requirement", (_k, c: HtmlChallenge) => {
    const r = judgePage(c, c.reference);
    expect(r.results.filter((x) => !x.passed).map((x) => x.text)).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.note).toBeNull();
  });

  it.each(challenges)("%s: the starter does not already pass", (_k, c: HtmlChallenge) => {
    expect(judgePage(c, c.starter).passed).toBe(false);
  });

  it.each(challenges)("%s: every common mistake fails at least one requirement", (_k, c: HtmlChallenge) => {
    expect(c.commonMistakes.length).toBeGreaterThanOrEqual(4);
    for (const wrong of c.commonMistakes) expect(judgePage(c, wrong).passed, `this page passed but should not:\n${wrong.slice(0, 300)}`).toBe(false);
  });

  it.each(challenges)("%s: each requirement is failed by at least one realistic wrong page", (_k, c: HtmlChallenge) => {
    // a requirement no wrong page ever fails would be decoration; each must be the cause of some failure
    const failedSomewhere = new Set<number>();
    for (const page of c.commonMistakes) for (const r of judgePage(c, page).results) if (!r.passed) failedSomewhere.add(r.index);
    expect([...Array(c.requirements.length).keys()].filter((i) => !failedSomewhere.has(i)).map((i) => c.requirements[i].text)).toEqual([]);
  });

  it("a different but correct page also passes (the checker is about requirements, not wording)", () => {
    const c = challenges.find(([k]) => k === "css-basics")![1];
    const alt = c.reference.replace("padding: 16px;", "padding-top: 16px;").replace("border: 2px solid var(--brand);", "border-width: 2px; border-style: solid;").replace("line-height: 1.6", "line-height: 1.5");
    expect(judgePage(c, alt).results.filter((r) => !r.passed).map((r) => r.text)).toEqual([]);
  });
});
