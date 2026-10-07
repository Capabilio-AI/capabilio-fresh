import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n), out) : n === "route.ts" && out.push(join(dir, n)));
  return out;
};

describe("Arena challenge admin routes", () => {
  it("every route checks for a platform admin before touching the database", () => {
    const routes = walk("app/api/arena-admin");
    expect(routes.length).toBeGreaterThanOrEqual(4);
    for (const f of routes) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("requirePlatformAdmin(");
      expect(src.indexOf("requirePlatformAdmin("), f).toBeLessThan(src.indexOf("createServiceClient()"));
    }
  });
  it("the admin page 404s for anyone who is not a platform admin", () => {
    const src = readFileSync("app/(app)/admin/arena-challenges/page.tsx", "utf8");
    expect(src).toContain("isPlatformAdmin(");
    expect(src.indexOf("notFound()")).toBeLessThan(src.indexOf("listChallenges("));
  });
});

describe("Roadmap template admin routes", () => {
  it("every route checks for a platform admin before touching the database", () => {
    const routes = walk("app/api/roadmap-admin");
    expect(routes.length).toBeGreaterThanOrEqual(3);
    for (const f of routes) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("requirePlatformAdmin(");
      expect(src.indexOf("requirePlatformAdmin("), f).toBeLessThan(src.indexOf("createServiceClient()"));
    }
  });
  it("the admin page 404s for anyone who is not a platform admin", () => {
    const src = readFileSync("app/(app)/admin/roadmap-templates/page.tsx", "utf8");
    expect(src).toContain("isPlatformAdmin(");
    expect(src.indexOf("notFound()")).toBeLessThan(src.indexOf("listTemplates("));
  });
});
