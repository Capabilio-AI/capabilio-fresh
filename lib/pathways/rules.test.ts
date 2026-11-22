import { describe, expect, it } from "vitest";
import { freshness, pathwayProblems, renderProse } from "./rules";
import { PathwaySpec, type FactSpec } from "./schema";

const fact = (over: Partial<FactSpec> = {}): FactSpec => ({ key: "limit", label: "Limit", value: "the stated limit", sourceUrl: "https://example.gov.in/rules", retrievedAt: "2026-11-01", ...over });
const base = (over: Record<string, unknown> = {}): PathwaySpec => PathwaySpec.parse({
  key: "sample", name: "Sample goal", kind: "exam", summary: "A competitive route into public service. The limit is {fact:limit}.",
  routes: [{ key: "main", kind: "exam", title: "The main exam", body: "Sit the exam run by the official body.", officialBody: "Official Body", officialUrl: "https://example.gov.in/", eligibilityFacts: ["limit"] }],
  stages: [{ key: "foundation", title: "Foundation", steps: [{ title: "Read the syllabus", body: "Start from the official syllabus." }] }, { key: "attempt", title: "Attempt", steps: [{ title: "Apply", body: "Apply when the notification appears." }] }],
  startThisWeek: [{ day: 1, title: "Read", body: "Read the official page." }, { day: 2, title: "List", body: "List the topics." }, { day: 3, title: "Plan", body: "Write the plan." }],
  watch: [{ title: "Official notices", url: "https://example.gov.in/notices", how: "Check the notices page weekly." }],
  honesty: ["Capabilio cannot certify an official result."], facts: [fact()], ...over,
});

describe("pathwayProblems", () => {
  it("accepts a pathway whose numbers live in cited facts", () => {
    expect(pathwayProblems(base(), new Date("2026-11-22"))).toEqual([]);
  });
  it.each([
    ["a year", "Apply in 2027 when it opens."],
    ["a date", "Applications close on 15 March."],
    ["an amount of money", "The fee is Rs. 100."],
    ["a percentage", "Only 2% pass."],
    ["an age or age limit", "Candidates must be of age 21 to 32."],
    ["a number of attempts, vacancies or seats", "You get 6 attempts."],
  ])("refuses %s written as plain words", (name, prose) => {
    const found = pathwayProblems(base({ summary: prose }), new Date("2026-11-22"));
    expect(found.some((p) => p.includes(`states ${name}`)), found.join(" | ")).toBe(true);
  });
  it("refuses a fact token that does not exist and a route citing a missing fact", () => {
    const found = pathwayProblems(base({ summary: "See {fact:nope}." }), new Date("2026-11-22"));
    expect(found).toContain("summary uses {fact:nope}, which does not exist");
    expect(pathwayProblems(base({ routes: [{ ...base().routes[0], eligibilityFacts: ["ghost"] }] }), new Date("2026-11-22"))).toContain('route "main" cites the fact "ghost", which does not exist');
  });
  it("refuses a fact read in the future, and one that expires before it was read", () => {
    expect(pathwayProblems(base({ facts: [fact({ retrievedAt: "2027-01-01" })] }), new Date("2026-11-22"))).toContain('fact "limit" was retrieved in the future');
    expect(pathwayProblems(base({ facts: [fact({ validUntil: "2026-10-01" })] }), new Date("2026-11-22"))).toContain('fact "limit" expires before it was retrieved');
  });
  it("refuses a fact without an https source at parse time", () => {
    expect(() => base({ facts: [fact({ sourceUrl: "http://example.gov.in" })] })).toThrow();
  });
});

describe("freshness and rendering", () => {
  it("is fresh, then due in the last two weeks, then stale", () => {
    const f = { retrievedAt: "2026-11-01" };
    expect(freshness(f, new Date("2026-11-22"))).toBe("fresh");
    expect(freshness(f, new Date("2027-01-25"))).toBe("due");
    expect(freshness(f, new Date("2027-03-01"))).toBe("stale");
    expect(freshness({ retrievedAt: "2026-11-01", validUntil: "2026-11-10" }, new Date("2026-11-22"))).toBe("stale");
  });
  it("replaces fact tokens with values and lists the facts used once", () => {
    const facts = new Map([["limit", fact()]]);
    const out = renderProse("It is {fact:limit}, again {fact:limit}, and {fact:gone}.", facts);
    expect(out.text).toBe("It is the stated limit, again the stated limit, and (unavailable).");
    expect(out.used).toHaveLength(1);
  });
});
