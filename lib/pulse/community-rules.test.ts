import { describe, expect, it } from "vitest";
import { canModerate, canRemoveMember, derivedAccess, slugify, type AcademicMembership } from "./community-rules";

describe("slugify", () => {
  it("makes url-safe slugs, strips accents and punctuation, and always returns something", () => {
    expect(slugify("Data Analytics & BI!")).toBe("data-analytics-bi");
    expect(slugify("Café Dév")).toBe("cafe-dev");
    expect(slugify("!!!")).toBe("community");
    expect(slugify("a".repeat(100)).length).toBe(60);
  });
});

describe("derivedAccess", () => {
  const student: AcademicMembership = { institutionId: "i1", branch: " CSE ", isStaff: false };
  const staff: AcademicMembership = { institutionId: "i1", branch: null, isStaff: true };
  const college = { kind: "college" as const, institutionId: "i1", branchKey: null };
  const branch = { kind: "branch" as const, institutionId: "i1", branchKey: "cse" };

  it("a student belongs to their college and their own branch only", () => {
    expect(derivedAccess(college, [student])).toEqual({ member: true, role: "member" });
    expect(derivedAccess(branch, [student])).toEqual({ member: true, role: "member" });
    expect(derivedAccess({ ...branch, branchKey: "ece" }, [student]).member).toBe(false);
    expect(derivedAccess({ ...college, institutionId: "i2" }, [student]).member).toBe(false);
  });
  it("college staff moderate their college community", () => {
    expect(derivedAccess(college, [staff])).toEqual({ member: true, role: "moderator" });
  });
  it("interest communities are never derived", () => {
    expect(derivedAccess({ kind: "interest", institutionId: null, branchKey: null }, [student]).member).toBe(false);
  });
});

describe("moderation", () => {
  it("only moderators and owners moderate; nobody removes an equal or higher rank", () => {
    expect(canModerate("member")).toBe(false);
    expect(canModerate(null)).toBe(false);
    expect(canModerate("moderator")).toBe(true);
    expect(canRemoveMember("owner", "moderator")).toBe(true);
    expect(canRemoveMember("owner", "owner")).toBe(false);
    expect(canRemoveMember("moderator", "member")).toBe(true);
    expect(canRemoveMember("moderator", "moderator")).toBe(false);
    expect(canRemoveMember("member", "member")).toBe(false);
  });
});
