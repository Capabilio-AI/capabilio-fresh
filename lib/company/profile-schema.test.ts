import { describe, expect, it } from "vitest";
import { CompanyProfileInputSchema, toProfileColumns } from "./profile-schema";

const base = { tagline: null, mission: null, industry: null, sizeBand: null, foundedYear: null, hqCity: null, logoUrl: null, accent: null, culture: [], perks: [], techStack: [] };

describe("company profile input", () => {
  it("accepts a complete profile", () => {
    expect(CompanyProfileInputSchema.safeParse({ ...base, tagline: "Hire on proof", industry: "Software", sizeBand: "11-50", foundedYear: 2021, accent: "#1A73E8", logoUrl: "https://x.com/l.png", perks: ["Remote"] }).success).toBe(true);
  });
  it("rejects fields the database would refuse, before they reach it", () => {
    expect(CompanyProfileInputSchema.safeParse({ ...base, accent: "blue" }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, sizeBand: "huge" }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, foundedYear: 1700 }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, perks: Array(13).fill("x") }).success).toBe(false);
  });
  it("is strict: it cannot be used to flip is_public or name another institution", () => {
    expect(CompanyProfileInputSchema.safeParse({ ...base, isPublic: true }).success).toBe(false);
    expect(CompanyProfileInputSchema.safeParse({ ...base, institutionId: "00000000-0000-0000-0000-000000000000" }).success).toBe(false);
  });
  it("turns blanks into nulls and lowercases the accent", () => {
    const cols = toProfileColumns({ ...base, tagline: "", accent: "#ABCDEF", culture: ["Ship"] });
    expect(cols.tagline).toBeNull();
    expect(cols.accent).toBe("#abcdef");
    expect(cols.culture).toEqual(["Ship"]);
  });
});
