import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Feedback, HistoryItem } from "@/lib/assess/types";
import { ActionBar } from "./ActionBar";
import { FeedbackPanel } from "./FeedbackPanel";
import { OptionTile, optionState } from "./OptionTile";
import { SegmentedProgress } from "./SegmentedProgress";

const fb = (over: Partial<Feedback> = {}): Feedback => ({
  isCorrect: true, timedOut: false, chosenIndex: 1, correctIndex: 1, explanation: "AVG over the filtered rows is the mean basket value.",
  alreadyAnswered: false, elo: { previous: 400, change: 4, newRating: 404 }, answeredCount: 1, total: 22, isLast: false, ...over,
});
const options = ["A text", "B text", "C text", "D text"];
const tiles = (feedback: Feedback | null, selected: number | null, locked = feedback !== null) =>
  options.map((t, i) => renderToStaticMarkup(h(OptionTile, { index: i, text: t, state: optionState(i, selected, feedback), locked, onPick: () => {} })));
const panel = (f: Feedback, isCareer = true) => renderToStaticMarkup(h(FeedbackPanel, { feedback: f, isCareer, reduce: true }));

describe("answer feedback rendering", () => {
  it("a correct pick turns green with a check, 'Correct answer', and the +4 ELO chip", () => {
    const f = fb();
    const [a, b] = tiles(f, 1);
    expect(b).toContain("--ok-soft");
    expect(b).toContain("Correct answer");
    expect(a).not.toContain("--bad-soft");
    const p = panel(f);
    expect(p).toContain("Correct");
    expect(p).not.toContain("Incorrect");
    expect(p).toContain("+4 ELO");
    expect(p).toContain("404");
    expect(p).toContain(f.explanation);
  });

  it("a wrong pick turns red with an X and 'Your answer'; the correct option turns green; shows −2", () => {
    const f = fb({ isCorrect: false, chosenIndex: 0, correctIndex: 2, elo: { previous: 404, change: -2, newRating: 402 } });
    const t = tiles(f, 0);
    expect(t[0]).toContain("--bad-soft");
    expect(t[0]).toContain("Your answer");
    expect(t[2]).toContain("--ok-soft");
    expect(t[2]).toContain("Correct answer");
    expect(t[1]).toContain("opacity-55");
    const p = panel(f);
    expect(p).toContain("Incorrect");
    expect(p).toContain("−2 ELO");
  });

  it("never relies on colour alone: an icon and a word on both outcomes", () => {
    const t = tiles(fb({ isCorrect: false, chosenIndex: 0, correctIndex: 2 }), 0);
    expect(t[0]).toMatch(/<svg/);
    expect(t[0]).toContain("Your answer");
    expect(t[2]).toMatch(/<svg/);
    expect(t[2]).toContain("Correct answer");
  });

  it("options are disabled while saving (choice made, feedback not back) and after feedback arrives", () => {
    for (const html of tiles(null, 2, true)) expect(html).toContain('disabled=""');
    for (const html of tiles(fb(), 1)) expect(html).toContain('disabled=""');
    for (const html of tiles(null, null, false)) expect(html).not.toContain('disabled=""');
  });

  it("the common assessment shows right/wrong feedback but no ELO", () => {
    expect(panel(fb({ elo: null }), false)).not.toContain("ELO");
  });

  it("a timed-out question says so, highlights the right answer, and counts as incorrect (no option marked as the student's)", () => {
    const f = fb({ isCorrect: false, timedOut: true, chosenIndex: -1, correctIndex: 2, elo: { previous: 404, change: -2, newRating: 402 } });
    const t = tiles(f, null);
    expect(t[2]).toContain("Correct answer");
    expect(t.join("")).not.toContain("Your answer");
    const p = panel(f);
    expect(p).toContain("Time&#x27;s up");
    expect(p).toContain("−2 ELO");
    expect(p).not.toContain("Incorrect<");
  });
});

describe("Next vs Submit", () => {
  const bar = (phase: Parameters<typeof ActionBar>[0]["phase"], feedback: Feedback | null) => renderToStaticMarkup(h(ActionBar, { phase, feedback, onNext: () => {}, onSubmit: () => {} }));
  it("Next, not Submit, on every question but the last", () => {
    const html = bar("feedback", fb({ isLast: false }));
    expect(html).toContain("Next");
    expect(html).not.toContain("Submit");
  });
  it("Submit, not Next, on the last question once it is answered", () => {
    const html = bar("feedback", fb({ isLast: true, answeredCount: 22 }));
    expect(html).toContain("Submit");
    expect(html).not.toContain("Next");
  });
  it("neither before the answer is confirmed, so the last question cannot be submitted unanswered", () => {
    expect(bar("answering", null)).toBe("");
    expect(bar("saving", null)).toBe("");
  });
});

describe("segmented progress", () => {
  it("shows how each answered question went, with the current one marked", () => {
    const history: HistoryItem[] = [{ position: 1, skillName: "SQL", group: "SQL", difficulty: "MEDIUM", correct: true }, { position: 2, skillName: "SQL", group: "SQL", difficulty: "HARD", correct: false }];
    const html = renderToStaticMarkup(h(SegmentedProgress, { total: 5, history, current: 3, answeredCurrent: false }));
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain("Question 1: correct");
    expect(html).toContain("Question 2: incorrect");
    expect(html.match(/a-current/g)).toHaveLength(1);
    expect(html.match(/<span/g)).toHaveLength(5);
  });
});
