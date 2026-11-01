import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrgContext = vi.fn();
vi.mock("@/lib/supabase/auth", () => ({ requireAuthedUser: async () => ({ supabase: {}, user: { id: "u1" } }) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("./context", () => ({ getOrgContext: (...a: unknown[]) => getOrgContext(...a) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));

import { orgPageContext } from "./page";
import { effectivePermissions } from "./roles";

const member = (role: string, kind: "student" | "staff" | "admin" | "tpo") => ({ role, kind, permissions: effectivePermissions(role, null) });

describe("orgPageContext", () => {
  beforeEach(() => getOrgContext.mockReset());

  it("sends a student session to the student dashboard instead of rendering an organisation page", async () => {
    getOrgContext.mockResolvedValue(member("student", "student"));
    await expect(orgPageContext()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("sends a signed-in user with no organisation membership to login", async () => {
    getOrgContext.mockResolvedValue(null);
    await expect(orgPageContext()).rejects.toThrow("REDIRECT:/login?path=organisation");
  });

  it("lets a principal through, with the edit permission", async () => {
    getOrgContext.mockResolvedValue(member("principal", "admin"));
    const { ctx } = await orgPageContext("manageProfile");
    expect(ctx.role).toBe("principal");
  });

  it("still 404s a staff member who lacks the page's permission", async () => {
    getOrgContext.mockResolvedValue(member("faculty", "staff"));
    await expect(orgPageContext("manageProfile")).rejects.toThrow("NOT_FOUND");
  });
});
