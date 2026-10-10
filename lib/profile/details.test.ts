import { describe, expect, it } from "vitest";
import { ProfileDetailsSchema, profileCompleteness } from "./details";

const base = { fullName: "Asha Rao", headline: "", bio: "", location: "" };

describe("ProfileDetailsSchema", () => {
  it("turns empty fields into null", () => {
    const r = ProfileDetailsSchema.parse(base);
    expect(r.headline).toBeNull();
    expect(r.bio).toBeNull();
  });
  it("rejects an empty name and an over-long headline", () => {
    expect(ProfileDetailsSchema.safeParse({ ...base, fullName: " " }).success).toBe(false);
    expect(ProfileDetailsSchema.safeParse({ ...base, headline: "x".repeat(121) }).success).toBe(false);
  });
});

describe("profileCompleteness", () => {
  const none = { avatarUrl: null, coverUrl: null, headline: null, bio: null, aspiringFor: null, college: null, branch: null, graduatingYear: null, hasBadge: false, passportShared: false };
  it("is 0 with nothing and lists every step", () => {
    const c = profileCompleteness(none);
    expect(c.percent).toBe(0);
    expect(c.missing).toHaveLength(10);
  });
  it("is 100 when everything is there", () => {
    expect(profileCompleteness({ avatarUrl: "a", coverUrl: "c", headline: "h", bio: "b", aspiringFor: "Data Analyst", college: "VIT", branch: "CSE", graduatingYear: 2027, hasBadge: true, passportShared: true }).percent).toBe(100);
  });
});
