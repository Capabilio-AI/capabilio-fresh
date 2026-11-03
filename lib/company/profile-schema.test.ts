import { describe, expect, it } from "vitest";
import { CompanyProfileInputSchema, splitProfile } from "./profile-schema";

const base = { tagline: null, about: null, websiteUrl: null, foundedYear: null, city: null, isPublic: false, mission: null, industry: null, sizeBand: null, culture: [], perks: [], techStack: [] };

describe("company profile input", () => {
  it("accepts a complete profile", () => {
    expect(CompanyProfileInputSchema.safeParse({ ...base, tagline: "Hire on proof", industry: "Software", sizeBand: "11-50", foundedYear: 2021, websiteUrl: "https://x.com", perks: ["Remote"], isPublic: true }).success).toBe(true);
  });
  it("rejects values the database would refuse, before they reach it", () => {
    expect(CompanyProfileInputSchema.safeParse({ ...base, sizeBand: "huge" }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, foundedYear: 1700 }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, perks: Array(13).fill("x") }).success).toBe(false);
  });
  it("is strict: no logo, cover or institution id can be smuggled in", () => {
    expect(CompanyProfileInputSchema.safeParse({ ...base, logoUrl: "https://x.com/l.png" }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, institutionId: "00000000-0000-0000-0000-000000000000" }).success).toBe(false);
  });
  it("splits across tables, turns blanks into nulls", () => {
    const { org, city, company } = splitProfile({ ...base, tagline: "", about: "We hire.", city: "Pune", culture: ["Ship"], isPublic: true });
    expect(org).toMatchObject({ tagline: null, bio: "We hire.", is_public: true });
    expect(city).toBe("Pune");
    expect(company).toMatchObject({ culture: ["Ship"] });
  });
});
