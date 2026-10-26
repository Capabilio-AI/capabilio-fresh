import { describe, expect, it } from "vitest";
import { matchRoleForStatedCareer, type DomainRoleRow } from "./taxonomy";

const role = (role_key: string, match_keywords: string[]) => ({ role_key, match_keywords }) as unknown as DomainRoleRow;
const ROLES = [
  role("data-analyst", ["data analyst", "data analytics", "analytics"]),
  role("data-engineer-sql", ["data engineer", "big data analyst", "big data analytics"]),
  role("soc-analyst", ["soc analyst", "soc l1", "siem analyst"]),
  role("data-scientist", ["data scientist", "a/b testing"]),
];
const pick = (c: string) => matchRoleForStatedCareer(ROLES, c)?.role_key ?? null;

describe("matchRoleForStatedCareer", () => {
  it("prefers the most specific keyword over an earlier, shorter one", () => {
    expect(pick("Big Data Analyst")).toBe("data-engineer-sql");
    expect(pick("Big Data Analytics")).toBe("data-engineer-sql");
    expect(pick("Data Analyst")).toBe("data-analyst");
  });

  it("does not match a keyword inside another word", () => {
    expect(pick("Associate Product Manager")).toBeNull();
    expect(pick("Social Media Executive")).toBeNull();
    expect(pick("Lab testing technician")).toBeNull();
    expect(pick("SOC Analyst")).toBe("soc-analyst");
  });

  it("returns null for no stated career", () => {
    expect(pick("")).toBeNull();
    expect(matchRoleForStatedCareer(ROLES, null)).toBeNull();
  });
});
