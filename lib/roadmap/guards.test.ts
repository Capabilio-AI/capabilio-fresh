import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(join(ROOT, dir))) return out; // an empty dir is not tracked by git, so CI may lack it
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
  it("the curriculum admin request schemas can never carry an institution, a user, or who approved something", () => {
    const src = read("lib/curriculum/schemas.ts");
    expect(src).not.toMatch(/institution_?id|user_?id|approved_?by|approved_?at|created_?by|reviewed_?by/i);
    expect((src.match(/\.strict\(\)/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
  it("every curriculum write goes through a function that checks ownership by the caller's institution", () => {
    for (const f of ["lib/curriculum/writes.ts", "lib/curriculum/mapping-writes.ts"]) {
      const src = read(f);
      expect(src, f).toMatch(/admin\.institutionId/);
      expect(src, f).not.toMatch(/service\.from\("(curriculum_imports|courses)"\)\.(delete|truncate)\(/); // soft delete only
    }
  });
  it("career and capability code never imports the AI provider directly, and the intent schemas cannot name a student", () => {
    const files = [...walk("lib/careers"), ...walk("lib/capability")];
    for (const f of files) expect(read(f), f).not.toMatch(/@\/lib\/ai\//);
    expect(read("lib/careers/intent-rules.ts")).not.toMatch(/student_?id|user_?id/i);
    expect((read("lib/careers/intent-rules.ts").match(/\.strict\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it("relevance and the capability combiner are pure: type imports only", () => {
    expect(read("lib/careers/relevance.ts")).not.toMatch(/^import (?!type)/m);
    expect(read("lib/careers/intent-rules.ts")).not.toMatch(/supabase|fetch\(/);
  });
  it("every career-intent route authenticates the student first and acts only on that student", () => {
    for (const f of walk("app/api/career-intent").filter((x) => x.endsWith("route.ts"))) {
      const src = read(f);
      expect(src, f).toContain("requireUser(");
      expect(src.indexOf("requireUser("), f).toBeLessThan(src.indexOf("createServiceClient()"));
      expect(src, f).toContain("auth.userId");
    }
  });
  it("catalog matching is pure and never reaches for the AI provider; the seed path cannot seed AI or college projects", () => {
    expect(read("lib/catalog/match.ts")).not.toMatch(/^import /m);
    for (const f of walk("lib/catalog")) expect(read(f), f).not.toMatch(/@\/lib\/ai\//);
    const seed = read("scripts/lib/catalog-seed.mjs");
    expect(seed).not.toMatch(/openai|groq|completeJson/i);
    expect(seed).toMatch(/source: z\.enum\(\["CAPABILIO", "MENTOR"\]\)/);
  });
  it("the roadmap engine core is pure: no database, no network, no AI, no filesystem", () => {
    for (const f of ["types", "gaps", "subjects", "readiness", "milestones", "generate"]) {
      expect(read(`lib/roadmap-engine/${f}.ts`), f).not.toMatch(/supabase|fetch\(|@\/lib\/ai\/|@\/lib\/roadmap\/suggest|node:|process\.env/);
    }
  });
  it("every student roadmap route authenticates first and acts only on the signed-in student", () => {
    const routes = walk("app/api/roadmap").filter((x) => x.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThanOrEqual(4);
    for (const f of routes) {
      const src = read(f);
      expect(src, f).toContain("requireUser(");
      expect(src.indexOf("requireUser("), f).toBeLessThan(src.indexOf("createServiceClient()"));
      expect(src, f).toContain("auth.userId");
      expect(src, f).not.toMatch(/formData\(|searchParams\.get\(["'`](user|student)/i); // nothing in the URL or a form can name a student (a career slot or node key is not a student)
      if (/request\.json\(/.test(src)) expect(src, f).toMatch(/Body(Schema)?\.safeParse/); // a body is only read through a schema
    }
  });
  it("roadmap persistence and regeneration never import the AI provider; only the explanation step reaches the propose-only module", () => {
    for (const f of ["store", "read", "service", "regenerate", "curriculum", "load", "prepare", "snapshot"]) expect(read(`lib/roadmap-engine/${f}.ts`), f).not.toMatch(/@\/lib\/ai\//);
    const importers = walk("lib/roadmap-engine").filter((f) => /@\/lib\/roadmap\/suggest/.test(read(f)));
    expect(importers).toEqual(["lib/roadmap-engine/explain.ts"]);
  });
  it("publishing regenerates in the background, after the response, and never fails the publish", () => {
    const src = read("app/api/admin/curriculum/imports/[id]/publish/route.ts");
    expect(src).toContain("after(");
    expect(src).toContain("regenerateForBranch(");
    expect(src).toMatch(/catch \(error\)/);
  });
  it("the gate uses the existing RBAC, not a new role system", () => {
    expect(read("lib/roadmap/admin-gate.ts")).toContain('can(supabase, userId, "organisation", "admin"');
  });
});

describe("the student roadmap page", () => {
  it("shows for every track — a student with no career goal gets a 'choose a career' state, not a 404 or an invented roadmap", () => {
    const page = read("app/(app)/dashboard/roadmap/page.tsx");
    expect(page).not.toMatch(/notFound\(\)/);
    expect(page).toContain("getRoadmapGraph("); // the career map; its empty states (no career, exploring, no roadmap) live in EmptyStates
    expect(read("components/roadmap/visual/EmptyStates.tsx")).toContain("Choose a career");
    expect(read("components/dashboard/DashboardSubNav.tsx")).not.toMatch(/Roadmap.*jobTrackOnly/);
  });
  it("the page acts on the signed-in student only: the version in the URL is read through an owner-scoped loader", () => {
    const page = read("app/(app)/dashboard/roadmap/page.tsx");
    expect(page).toContain("requireAuthedUser()");
    expect(page).toContain("getRoadmapGraph(createServiceClient(), user.id,"); // the student id always comes from the session, never the URL
  });
  it("the regulation setter updates only the caller's own memberships and its body cannot name a student", () => {
    expect(read("lib/roadmap-engine/regulation.ts")).toMatch(/\.eq\("user_id", userId\)/);
    expect(read("lib/roadmap-engine/regulation.ts")).not.toMatch(/student_?id|user_?id:/);
    expect(read("lib/roadmap-engine/regulation.ts")).toMatch(/\.strict\(\)/);
  });
  it("roadmap components never render model text outside the labelled explanation, and fetch only through the shared helper", () => {
    for (const f of walk("components/roadmap/v2")) expect(read(f), f).not.toMatch(/dangerouslySetInnerHTML|@\/lib\/ai\//);
    expect(read("components/roadmap/v2/Plan.tsx")).toMatch(/AI-written from your data/);
  });
});

describe("AI never touches what the student is shown", () => {
  it("only the propose-only suggestion module imports the AI provider anywhere under lib/roadmap or app/api/admin", () => {
    const files = [...walk("lib/roadmap"), ...walk("app/api/admin"), ...walk("components/roadmap"), ...walk("components/admin")];
    const importers = files.filter((f) => /@\/lib\/ai\//.test(read(f)));
    // derive.ts is the extraction pipeline's enrichment: it only STAGES labelled, evidence-grounded INFERRED outcomes and AI_SUGGESTED mappings
    expect(importers).toEqual(["lib/roadmap/extract/derive.ts", "lib/roadmap/suggest.ts"]);
  });
  it("the suggestion module has no database access, and its route performs no writes", () => {
    expect(read("lib/roadmap/suggest.ts")).not.toMatch(/supabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    expect(read("app/api/admin/curriculum/suggest-mapping/route.ts")).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|setMapping|addSubjects/);
  });
  it("syllabus extraction only stages: no extraction code or route touches the curriculum tables directly", () => {
    const files = [...walk("lib/roadmap/extract"), ...walk("app/api/admin/curriculum/extractions")].filter((f) => !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) expect(read(f), f).not.toMatch(/curriculum_subjects|curriculum_subject_skill_map|addSubjects|setMapping/);
  });
  it("extraction can only ever write AI mappings as SUGGESTED — never a confirmed, manual or college-confirmed one", () => {
    const persist = read("lib/roadmap/extract/persist.ts");
    expect(persist).toMatch(/mapping_source: "AI_SUGGESTED"/);
    expect(persist).toMatch(/status: "SUGGESTED"/);
    expect(persist).not.toMatch(/status: "CONFIRMED"|"COLLEGE_CONFIRMED"|"MANUAL"|approved_by|approved_at/);
    for (const f of ["persist.ts", "enrich.ts", "section.ts", "programs.ts", "ground.ts"]) expect(read(`lib/roadmap/extract/${f}`), f).not.toMatch(/@\/lib\/ai\//);
  });
  it("the gap engine is pure: no imports at all", () => {
    expect(read("lib/roadmap/build.ts")).not.toMatch(/^import /m);
  });
});
