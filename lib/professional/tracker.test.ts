import { describe, expect, it } from "vitest";
import { insights, validateApplication, validateApplicationUpdate, validateFeedback } from "./tracker";

const NOW = new Date("2026-11-16T00:00:00Z");
const APP = "11111111-1111-4111-8111-111111111111";

describe("validateApplication", () => {
  it("accepts the minimum and defaults to applied", () => {
    expect(validateApplication({ company: " Helio  Payments ", role: "Staff Engineer" }, NOW)).toEqual({ ok: true, value: { company: "Helio Payments", role: "Staff Engineer", link: null, stage: "applied", appliedOn: null, notes: null } });
  });
  it("accepts a link, stage and date, and refuses bad ones", () => {
    expect(validateApplication({ company: "A", role: "B", link: "https://jobs.example/1", stage: "interview", appliedOn: "2026-11-01" }, NOW)).toMatchObject({ ok: true, value: { stage: "interview", appliedOn: "2026-11-01" } });
    expect(validateApplication({ company: "A", role: "B", link: "javascript:alert(1)" }, NOW).ok).toBe(false);
    expect(validateApplication({ company: "A", role: "B", stage: "dreaming" }, NOW).ok).toBe(false);
    expect(validateApplication({ company: "A", role: "B", appliedOn: "2027-01-01" }, NOW).ok).toBe(false);
    expect(validateApplication({ company: "", role: "B" }, NOW).ok).toBe(false);
  });
});

describe("validateApplicationUpdate", () => {
  it("allows a stage and notes, and nothing else", () => {
    expect(validateApplicationUpdate({ stage: "offer", notes: " call Monday " })).toEqual({ ok: true, value: { stage: "offer", notes: "call Monday" } });
    expect(validateApplicationUpdate({ company: "X" }).ok).toBe(false);
    expect(validateApplicationUpdate({ stage: "nope" }).ok).toBe(false);
  });
});

describe("validateFeedback", () => {
  const base = { applicationId: APP, round: "technical", outcome: "negative", toImprove: "System design depth" };
  it("accepts a round with a note", () => expect(validateFeedback(base, NOW)).toMatchObject({ ok: true, value: { givenOn: "2026-11-16", toImprove: "System design depth" } }));
  it("needs a note unless the outcome is still pending", () => {
    expect(validateFeedback({ ...base, toImprove: "" }, NOW).ok).toBe(false);
    expect(validateFeedback({ ...base, outcome: "pending", toImprove: "" }, NOW).ok).toBe(true);
  });
  it("refuses an unknown application id, round or outcome", () => {
    expect(validateFeedback({ ...base, applicationId: "x" }, NOW).ok).toBe(false);
    expect(validateFeedback({ ...base, round: "coffee" }, NOW).ok).toBe(false);
    expect(validateFeedback({ ...base, outcome: "great" }, NOW).ok).toBe(false);
  });
});

describe("insights", () => {
  it("counts outcomes, rounds and recurring improvement themes", () => {
    const i = insights([
      { round: "technical", outcome: "negative", to_improve: "System design depth, communication" },
      { round: "technical", outcome: "mixed", to_improve: "Deeper system design answers" },
      { round: "hr", outcome: "positive", to_improve: null },
      { round: "final", outcome: "pending", to_improve: null },
    ]);
    expect(i.total).toBe(4);
    expect(i.byOutcome).toEqual({ positive: 1, mixed: 1, negative: 1, pending: 1 });
    expect(i.byRound).toEqual([{ round: "technical", positive: 0, total: 2 }, { round: "hr", positive: 1, total: 1 }]);
    expect(i.themes.map((t) => t.word)).toEqual(["design", "system"]);
  });
});
