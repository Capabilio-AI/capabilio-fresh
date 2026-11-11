import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("CRT company admin", () => {
  it("every method checks for a platform admin before touching the database", () => {
    const src = readFileSync("app/api/crt-admin/companies/route.ts", "utf8");
    const handlers = src.split(/export async function /).slice(1);
    expect(handlers).toHaveLength(3);
    for (const h of handlers) {
      expect(h).toContain("requirePlatformAdmin(");
      expect(h.indexOf("requirePlatformAdmin(")).toBeLessThan(h.indexOf("createServiceClient()"));
    }
  });
  it("the admin page 404s for anyone who is not a platform admin", () => {
    const src = readFileSync("app/(app)/admin/crt-companies/page.tsx", "utf8");
    expect(src).toContain("isPlatformAdmin(");
    expect(src.indexOf("notFound()")).toBeLessThan(src.indexOf("listAllCompanies("));
  });
  it("students can only list published companies, never drafts", () => {
    const src = readFileSync("lib/crt/company-server.ts", "utf8");
    expect(src).toContain("listCompanies = (service: Service, userId: string): Promise<CompanyView[]> => loadCompanies(service, userId, true)");
    expect(src).toMatch(/eq\("status", "PUBLISHED"\)/);
  });
});
