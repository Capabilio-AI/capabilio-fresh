import { describe, expect, it } from "vitest";
import { CompanyInput, MAX_ROUND_QUESTIONS, canPublish, paperOf, roundSeconds, secondsPerQuestion, sectionsFrom, type CompanyRound } from "./companies";

const online: CompanyRound = { position: 1, kind: "online_assessment", title: "Online assessment", minutes: 60, negativeMarking: 0.25, notes: null, sections: [{ category: "aptitude", count: 20 }, { category: "reasoning", count: 15 }, { category: "verbal", count: 15 }] };
const interview: CompanyRound = { position: 2, kind: "technical_interview", title: "Technical interview", minutes: 30, negativeMarking: 0, notes: null, sections: [] };

describe("roundSeconds and secondsPerQuestion", () => {
  it("takes the company's time and spreads it over the questions, never below 20 seconds each", () => {
    expect(roundSeconds(online)).toBe(3600);
    expect(secondsPerQuestion(online)).toBe(72);
    expect(secondsPerQuestion({ ...online, minutes: 10 })).toBe(20);
  });
  it("falls back to one minute a question when the pattern gives no time", () => {
    expect(secondsPerQuestion({ ...online, minutes: null })).toBe(60);
    expect(roundSeconds({ ...online, minutes: null })).toBe(50 * 60);
  });
});

describe("sectionsFrom", () => {
  it("reads sections out of stored JSON and drops anything malformed", () => {
    expect(sectionsFrom([{ category: "aptitude", count: 10 }, { category: "nonsense", count: 3 }, { category: "verbal", count: -2 }, "x"])).toEqual([{ category: "aptitude", count: 10 }]);
    expect(sectionsFrom(null)).toEqual([]);
  });
});

describe("paperOf", () => {
  it("is the test definition a round gives: its sections as the simulator's parts, in the company's time", () => {
    const p = paperOf("TCS NQT-style", online)!;
    expect(p.title).toBe("TCS NQT-style: Online assessment");
    expect(p.parts).toEqual(online.sections);
    expect(p.questions).toBe(50);
    expect(p.secondsPerQuestion).toBe(72);
  });
  it("is null for a round that is not a timed paper", () => {
    expect(paperOf("X", interview)).toBeNull();
    expect(paperOf("X", { ...online, sections: [] })).toBeNull();
  });
  it("caps a paper so one mock cannot ask for a thousand questions", () => {
    expect(paperOf("X", { ...online, sections: [{ category: "aptitude", count: MAX_ROUND_QUESTIONS + 1 }] })).toBeNull();
  });
});

describe("canPublish", () => {
  const company = { slug: "tcs-nqt", name: "TCS NQT", sector: "Technology" as const, about: null, process: ["Online test", "Interview"], officialUrl: "https://example.com/careers", patternSourceUrl: "https://example.com/pattern", patternCheckedOn: "2026-11-01" };
  it("needs a source, a check date and at least one paper", () => {
    expect(canPublish(company, [online, interview])).toEqual({ ok: true });
    expect(canPublish({ ...company, patternSourceUrl: null }, [online])).toMatchObject({ ok: false });
    expect(canPublish({ ...company, patternCheckedOn: null }, [online])).toMatchObject({ ok: false });
    expect(canPublish(company, [interview])).toMatchObject({ ok: false });
    expect(canPublish(company, [])).toMatchObject({ ok: false });
  });
});

describe("CompanyInput", () => {
  const ok = { slug: "infosys", name: "Infosys", sector: "Technology", about: "IT services.", process: ["Online test"], officialUrl: "https://www.infosys.com/careers", patternSourceUrl: null, patternCheckedOn: null, rounds: [online] };
  it("accepts a draft with a source left blank", () => expect(CompanyInput.safeParse(ok).success).toBe(true));
  it("rejects a slug with spaces, a non-https link, and two rounds in the same position", () => {
    expect(CompanyInput.safeParse({ ...ok, slug: "In fosys" }).success).toBe(false);
    expect(CompanyInput.safeParse({ ...ok, officialUrl: "http://x.com" }).success).toBe(false);
    expect(CompanyInput.safeParse({ ...ok, rounds: [online, { ...interview, position: 1 }] }).success).toBe(false);
  });
});
