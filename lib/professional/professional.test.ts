import { describe, expect, it } from "vitest";
import { mentorEligibility, mentorableRoles, mentorUnlockDate, verifiedMonths } from "./tenure";
import { matchRoles, normaliseCompany } from "./verify-match";
import type { TimelineRole } from "./types";

const role = (id: string, start: string, end: string | null, tier: TimelineRole["tier"] = "epfo"): TimelineRole => ({ id, company: id, title: "Engineer", start, end, tier });
const NOW = new Date("2026-11-14T00:00:00Z");

describe("tenure", () => {
  it("counts overlapping verified jobs once and ignores gaps and self-claimed roles", () => {
    const roles = [role("a", "2010-01-01", "2015-01-01"), role("b", "2014-01-01", "2016-01-01"), role("c", "2017-01-01", "2018-01-01"), role("d", "2000-01-01", "2010-01-01", "self_claimed")];
    expect(verifiedMonths(roles, NOW)).toBe(Math.floor((6 * 365.25 + 365) / 30.4375));
  });
  it("opens mentoring at ten verified years, not before", () => {
    expect(mentorEligibility([role("a", "2016-11-15", null)], NOW).eligible).toBe(false);
    const ok = mentorEligibility([role("a", "2016-11-01", null)], NOW);
    expect(ok.eligible).toBe(true);
    expect(ok.monthsToGo).toBe(0);
  });
  it("only offers verified roles of a year or more as mentoring roles", () => {
    const roles = [role("a", "2020-01-01", "2023-01-01"), role("b", "2023-02-01", "2023-06-01"), role("c", "2018-01-01", "2022-01-01", "self_claimed")];
    expect(mentorableRoles(roles, NOW).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("mentor unlock date", () => {
  it("finds the day ten verified years were reached, and projects it for someone still short", () => {
    const reached = mentorUnlockDate([role("a", "2010-01-01", "2015-01-01"), role("b", "2016-01-01", null)], NOW)!;
    expect(reached.reached).toBe(true);
    expect(reached.date.toISOString().slice(0, 7)).toMatch(/^(2020-12|2021-01)$/); // 5 years by 2015, plus 5 more from 2016
    const short = mentorUnlockDate([role("a", "2023-11-14", null)], NOW)!;
    expect(short.reached).toBe(false);
    expect(short.date.getUTCFullYear()).toBe(2033);
    expect(mentorUnlockDate([role("a", "2023-01-01", "2024-01-01")], NOW)).toBeNull();
  });
});

describe("EPFO matching", () => {
  it("treats company suffixes as noise", () => expect(normaliseCompany("Infosys Ltd.")).toBe(normaliseCompany("INFOSYS LIMITED")));
  const resume = [{ ...role("1", "2019-01-01", "2022-03-01"), company: "Infosys Ltd" }, { ...role("2", "2022-04-01", null), company: "Stealth Startup" }, { ...role("3", "2015-01-01", "2016-01-01"), company: "TCS" }];
  const epfo = [{ establishment: "INFOSYS LIMITED", from: "2019-02-01", to: "2022-02-01" }, { establishment: "Tata Consultancy Services", from: "2015-01-01", to: "2016-01-01" }, { establishment: "TCS", from: "2020-01-01", to: "2021-01-01" }];
  it("verifies matches, leaves unknown employers self-claimed, flags date mismatches", () => {
    const m = matchRoles(resume, epfo);
    expect(m.map((x) => x.status)).toEqual(["verified", "self_claimed", "dates_differ"]);
    expect(m[2].epfo?.from).toBe("2020-01-01");
  });
});
