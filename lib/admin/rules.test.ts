import { describe, expect, it } from "vitest";
import { ageLabel, checkDecision, csvCell, decisionNotice, isOrgRole, isStale, kindOfProfile, lastDays, perDay, toCsv } from "./rules";

describe("kindOfProfile", () => {
  it("maps the path and defaults to other", () => {
    expect(kindOfProfile("student")).toBe("student");
    expect(kindOfProfile("professional")).toBe("professional");
    expect(kindOfProfile(null)).toBe("other");
    expect(kindOfProfile("executive")).toBe("other");
  });
});

describe("checkDecision", () => {
  it("needs a reason to reject", () => {
    expect(checkDecision({ decision: "rejected", reason: "no" }).ok).toBe(false);
    expect(checkDecision({ decision: "rejected", reason: "Documents do not match the college name." })).toEqual({ ok: true, value: { decision: "rejected", reason: "Documents do not match the college name." } });
  });
  it("lets an approval go without a reason and asks a hold for one", () => {
    expect(checkDecision({ decision: "approved", reason: "" })).toEqual({ ok: true, value: { decision: "approved", reason: null } });
    expect(checkDecision({ decision: "hold", reason: "" }).ok).toBe(false);
    expect(checkDecision({ decision: "hold", reason: "Need the principal letter" }).ok).toBe(true);
  });
  it("refuses an unknown decision and an over-long reason", () => {
    expect(checkDecision({ decision: "maybe", reason: "x" }).ok).toBe(false);
    expect(checkDecision({ decision: "rejected", reason: "x".repeat(501) }).ok).toBe(false);
  });
});

describe("decisionNotice", () => {
  it("quotes the rejection reason and escapes it in the email", () => {
    const n = decisionNotice({ subject: "Mentor application", decision: "rejected", reason: "Profile says <b>9</b> years, work history shows 4.", name: "Asha Rao" });
    expect(n.title).toBe("Mentor application: not approved");
    expect(n.body).toContain("Profile says <b>9</b> years");
    expect(n.html).toContain("&lt;b&gt;9&lt;/b&gt;");
    expect(n.text).toContain("Hi Asha,");
  });
  it("says approved without a reason", () => {
    expect(decisionNotice({ subject: "College account", decision: "approved", reason: null }).title).toBe("College account: approved");
  });
});

describe("helpers", () => {
  it("knows organisation roles", () => {
    expect(isOrgRole("tpo")).toBe(true);
    expect(isOrgRole("student")).toBe(false);
  });
  it("ages and staleness", () => {
    const now = new Date("2026-11-16T12:00:00Z");
    expect(ageLabel("2026-11-16T11:30:00Z", now)).toBe("30m");
    expect(ageLabel("2026-11-13T12:00:00Z", now)).toBe("3d");
    expect(isStale("2026-11-12T12:00:00Z", now)).toBe(true);
    expect(isStale("2026-11-15T12:00:00Z", now)).toBe(false);
  });
  it("buckets per day", () => {
    const days = lastDays(3, new Date("2026-11-16T10:00:00Z"));
    expect(days).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(perDay(["2026-11-16T01:00:00Z", "2026-11-16T09:00:00Z", "2026-11-14T00:00:00Z"], days)).toEqual([1, 0, 2]);
  });
  it("makes safe CSV", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(toCsv(["n", "x"], [["Asha", 1]])).toBe("n,x\nAsha,1");
  });
});
