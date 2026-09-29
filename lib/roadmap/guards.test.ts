import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(rel);
  }
  return out;
}

describe("admin surfaces are all gated by the organisation-admin check", () => {
  it("every /api/admin route handler calls requireOrgAdmin before doing anything", () => {
    const routes = walk("app/api/admin").filter((f) => f.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThanOrEqual(4);
    for (const f of routes) {
      const src = read(f);
      expect(src, f).toContain("requireOrgAdmin(");
      // The gate must come before any service-role use.
      expect(src.indexOf("requireOrgAdmin("), f).toBeLessThan(src.indexOf("createServiceClient()"));
    }
  });
  it("the curriculum page needs the Curriculum permission (404 otherwise) and derives the institution from the caller", () => {
    const src = read("app/org/curriculum/page.tsx");
    expect(src).toContain('orgPageContext("manageCurriculum")');
    expect(src).toContain("ctx.institutionId");
    expect(read("lib/org/page.ts")).toContain("notFound()");
  });
  it("the old student-shell URL only redirects into the organisation workspace", () => {
    const src = read("app/(app)/admin/curriculum/page.tsx");
    expect(src).toContain('redirect("/org/curriculum")');
    expect(src).not.toContain("createServiceClient");
  });
  it("no request body schema can carry an institution or user id", () => {
    expect(read("lib/roadmap/schemas.ts")).not.toMatch(/institution_?id|user_?id/i);
  });
  it("the gate uses the existing RBAC, not a new role system", () => {
    expect(read("lib/roadmap/admin-gate.ts")).toContain('can(supabase, userId, "organisation", "admin"');
  });
});

describe("roadmap visibility is job-track only", () => {
  it("the page returns 404 unless the loader says the roadmap applies", () => {
    expect(read("app/(app)/dashboard/roadmap/page.tsx")).toMatch(/if \(!result\.applicable\) notFound\(\)/);
  });
  it("the loader gates on the existing track resolution, not a reimplementation", () => {
    const src = read("lib/roadmap/load.ts");
    expect(src).toContain("getStudentDirection(");
    expect(src).toContain('direction.track !== "job"');
  });
  it("the dashboard tab is job-track-only", () => {
    expect(read("components/dashboard/DashboardSubNav.tsx")).toMatch(/Roadmap.*jobTrackOnly: true/);
  });
});

describe("AI never touches what the student is shown", () => {
  it("only the propose-only suggestion module imports the AI provider anywhere under lib/roadmap or app/api/admin", () => {
    const files = [...walk("lib/roadmap"), ...walk("app/api/admin"), ...walk("components/roadmap"), ...walk("components/admin")];
    const importers = files.filter((f) => /@\/lib\/ai\//.test(read(f)));
    expect(importers).toEqual(["lib/roadmap/suggest.ts"]);
  });
  it("the suggestion module has no database access, and its route performs no writes", () => {
    expect(read("lib/roadmap/suggest.ts")).not.toMatch(/supabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    expect(read("app/api/admin/curriculum/suggest-mapping/route.ts")).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|setMapping|addSubjects/);
  });
  it("the gap engine is pure: no imports at all", () => {
    expect(read("lib/roadmap/build.ts")).not.toMatch(/^import /m);
  });
});
