import { describe, expect, it } from "vitest";
import { specHash, validatePathway } from "./store";

const good = {
  key: "sample", name: "Sample goal", kind: "exam", summary: "A route into public service. The limit is {fact:limit}.",
  routes: [{ key: "main", kind: "exam", title: "The main exam", body: "Sit the exam run by the official body.", officialBody: "Official Body", officialUrl: "https://example.gov.in/", eligibilityFacts: ["limit"] }],
  stages: [{ key: "foundation", title: "Foundation", steps: [{ title: "Read", body: "Read the official syllabus." }] }, { key: "attempt", title: "Attempt", steps: [{ title: "Apply", body: "Apply when it opens." }] }],
  startThisWeek: [{ day: 1, title: "Read", body: "Read the page." }, { day: 2, title: "List", body: "List topics." }, { day: 3, title: "Plan", body: "Write a plan." }],
  watch: [{ title: "Notices", url: "https://example.gov.in/notices", how: "Check weekly." }],
  honesty: ["Capabilio cannot certify an official result."],
  facts: [{ key: "limit", label: "Limit", value: "as stated", sourceUrl: "https://example.gov.in/rules", retrievedAt: "2026-11-01" }],
};

describe("validatePathway", () => {
  it("accepts a sound pathway and hashes it the same way every time", () => {
    const spec = validatePathway(good, new Date("2026-11-22"));
    expect(specHash(spec)).toBe(specHash(validatePathway(good, new Date("2026-11-22"))));
  });
  it("throws one message naming every reason, schema or rule", () => {
    const bad = { ...good, summary: "Apply in 2027.", facts: [{ ...good.facts[0], sourceUrl: "http://example.gov.in" }] };
    expect(() => validatePathway(bad, new Date("2026-11-22"))).toThrow(/https/);
    expect(() => validatePathway({ ...good, summary: "Apply in 2027 {fact:limit}." }, new Date("2026-11-22"))).toThrow(/a year/);
  });
});
