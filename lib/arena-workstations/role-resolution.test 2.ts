import { describe, expect, it } from "vitest";
import type { DomainRoleRow } from "./taxonomy";
import { resolveDomainRole } from "./role-resolution";

const role = (role_key: string, match_keywords: string[]) => ({ role_key, match_keywords }) as DomainRoleRow;
const ROLES = [role("data-analyst", ["data analyst"]), role("devops-engineer", ["devops"])];
const none = { activeRoleKey: null, engagedRoleKey: null, statedRole: null };

describe("resolveDomainRole", () => {
  it("never falls back to the first enabled role", () => {
    expect(resolveDomainRole(ROLES, none)).toEqual({ role: null, via: null });
    expect(resolveDomainRole(ROLES, { ...none, statedRole: "Product Manager" })).toEqual({ role: null, via: null });
  });

  it("returns nothing when there are no roles at all", () => {
    expect(resolveDomainRole([], { ...none, statedRole: "Data Analyst" }).role).toBeNull();
  });

  it("prefers an explicit choice, then the stated career, then the engaged role", () => {
    expect(resolveDomainRole(ROLES, { activeRoleKey: "devops-engineer", engagedRoleKey: "data-analyst", statedRole: "Data Analyst" })).toMatchObject({ via: "explicit", role: { role_key: "devops-engineer" } });
    expect(resolveDomainRole(ROLES, { activeRoleKey: null, engagedRoleKey: "devops-engineer", statedRole: "Data Analyst" })).toMatchObject({ via: "stated", role: { role_key: "data-analyst" } });
    expect(resolveDomainRole(ROLES, { activeRoleKey: null, engagedRoleKey: "devops-engineer", statedRole: "Product Manager" })).toMatchObject({ via: "engaged", role: { role_key: "devops-engineer" } });
  });

  it("ignores an explicit or engaged key that is not an enabled role", () => {
    expect(resolveDomainRole(ROLES, { activeRoleKey: "gone", engagedRoleKey: "also-gone", statedRole: null })).toEqual({ role: null, via: null });
  });
});
