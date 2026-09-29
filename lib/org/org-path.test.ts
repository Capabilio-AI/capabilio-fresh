import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IN_APP_APPROVABLE_ROLES, PERMISSIONS, allowed, kindOf, landingFor } from "./roles";
import { orgNavFor } from "./nav";
import { postVisibleTo } from "./presence";
import { MIN_COHORT, summarizeCohorts, summarizeProjects } from "./insights";
import { GradeSchema, MaterialSchema, PlacementSchema, PostSchema, ProjectSchema, ReportSchema } from "./schemas";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("role mapping and the permissions matrix", () => {
  it("maps app roles to spec kinds and nothing else", () => {
    expect(kindOf("faculty")).toBe("staff");
    expect(kindOf("hod")).toBe("staff");
    expect(kindOf("principal")).toBe("admin");
    expect(kindOf("vice_principal")).toBe("admin");
    expect(kindOf("tpo")).toBe("tpo");
    expect(kindOf("student")).toBe("student");
    for (const r of ["ceo", "mentor", "professional", "company_admin", "nonsense"]) expect(kindOf(r)).toBeNull();
  });
  it("matches spec §6", () => {
    expect(allowed("student", "joinGroup")).toBe(true);
    expect(allowed("staff", "joinGroup")).toBe(false);
    expect(allowed("tpo", "gradeProject")).toBe(false);
    expect(allowed("tpo", "createProject")).toBe(false);
    expect(allowed("staff", "postPlacement")).toBe(false);
    expect(allowed("tpo", "postPlacement")).toBe(true);
    expect(allowed("admin", "postPlacement")).toBe(true);
    expect(allowed("tpo", "viewInsights")).toBe(true);
    expect(allowed("staff", "viewInsights")).toBe(false);
    expect(allowed("staff", "manageProfile")).toBe(false);
    expect(allowed("admin", "approveMembers")).toBe(true);
    expect(allowed(null, "viewInsights")).toBe(false);
    expect(Object.keys(PERMISSIONS).length).toBeGreaterThan(5);
  });
  it("admins can never approve other admins in-app", () => {
    expect(IN_APP_APPROVABLE_ROLES).not.toContain("principal");
    expect(IN_APP_APPROVABLE_ROLES).not.toContain("vice_principal");
  });
  it("routes org roles to /org, students to the assessment, roles without a workspace to nothing", () => {
    expect(landingFor("tpo")).toBe("/org");
    expect(landingFor("faculty")).toBe("/org");
    expect(landingFor("student")).toBe("/assessment");
    expect(landingFor("company_admin")).toBeNull();
  });
  it("nav only offers pages the role can use", () => {
    expect(orgNavFor("tpo").map((n) => n.label)).toEqual(["Overview", "Placements", "Insights"]);
    expect(orgNavFor("staff").map((n) => n.label)).not.toContain("Members");
    expect(orgNavFor("admin").map((n) => n.label)).toContain("Members");
    expect(orgNavFor("student")).toEqual([]);
  });
});

describe("post visibility (spec §3.3)", () => {
  const event = { status: "published", type: "event", is_public: false } as const;
  const note = { status: "published", type: "announcement", is_public: false } as const;
  it("drafts are never visible, even to members", () => {
    expect(postVisibleTo({ post: { ...event, status: "draft" }, profilePublic: true, isMember: true })).toBe(false);
  });
  it("public events need an opted-in page; announcements need the public flag too", () => {
    expect(postVisibleTo({ post: event, profilePublic: true, isMember: false })).toBe(true);
    expect(postVisibleTo({ post: event, profilePublic: false, isMember: false })).toBe(false);
    expect(postVisibleTo({ post: note, profilePublic: true, isMember: false })).toBe(false);
    expect(postVisibleTo({ post: { ...note, is_public: true }, profilePublic: true, isMember: false })).toBe(true);
  });
  it("members see everything published", () => {
    expect(postVisibleTo({ post: note, profilePublic: false, isMember: true })).toBe(true);
  });
});

describe("insights are aggregate-only and suppress small cohorts", () => {
  const cohort = (n: number, goal: string | null, branch = "CSE") =>
    Array.from({ length: n }, (_, i) => ({ userId: `${branch}-${goal}-${i}`, branch, endYear: 2028, goalState: goal }));
  it("hides goals and participation under the minimum", () => {
    const [c] = summarizeCohorts(cohort(MIN_COHORT - 1, "job"), new Set());
    expect(c).toMatchObject({ size: MIN_COHORT - 1, goals: null, projectParticipation: null });
  });
  it("counts goals and participation once the cohort is large enough; unanswered = unset", () => {
    const students = [...cohort(3, "job"), ...cohort(1, "higher_studies"), ...cohort(1, null)];
    const [c] = summarizeCohorts(students, new Set([students[0].userId, students[3].userId]));
    expect(c.goals).toEqual({ job: 3, higher_studies: 1, entrepreneur: 0, not_sure: 0, unset: 1 });
    expect(c.projectParticipation).toBeCloseTo(0.4);
  });
  it("never exposes a user id in the summary", () => {
    expect(JSON.stringify(summarizeCohorts(cohort(6, "job"), new Set()))).not.toContain("CSE-job-0");
  });
  it("hides the grade distribution below the minimum and computes rates from real rows", () => {
    const groups = [{ status: "graded" }, { status: "submitted" }, { status: "forming" }] as const;
    const s = summarizeProjects(2, [...groups], [{ grade: "A" }], [{ branch: "CSE" }, { branch: "CSE" }, { branch: "ECE" }]);
    expect(s).toMatchObject({ projects: 2, groups: 3, submitted: 2, graded: 1, gradeDistribution: null });
    expect(s.materialsByBranch).toEqual([{ branch: "CSE", count: 2 }, { branch: "ECE", count: 1 }]);
  });
});

describe("request schemas are strict — no role / institution / status / user id from a client", () => {
  const project = { title: "P", brief: "B", submissionType: "in_app", weeklyReportRequired: true, deadlineAt: "2099-01-01T10:00:00Z" };
  it("rejects extra authority fields on every write body", () => {
    const attacks = { institutionId: uuid, role: "principal", status: "active", userId: uuid, teamSize: 1, authorMembershipId: uuid };
    for (const [name, schema, ok] of [
      ["project", ProjectSchema, project],
      ["material", MaterialSchema, { type: "link", title: "T", url: "https://x.co", branch: "CSE", year: 1 }],
      ["report", ReportSchema, { groupId: uuid, weekNumber: 1, content: "c" }],
      ["grade", GradeSchema, { groupId: uuid, grade: "A" }],
      ["placement", PlacementSchema, { role: "r", company: "c", opportunityType: "job" }],
      ["post", PostSchema, { type: "announcement", title: "t", body: "b" }],
    ] as const) {
      expect(schema.safeParse(ok).success, `${name} baseline`).toBe(true);
      // (a placement's `role` is the job title, not an account role, so it is a legitimate field there)
      for (const [k, v] of Object.entries(attacks).filter(([k]) => !(name === "placement" && k === "role"))) expect(schema.safeParse({ ...ok, [k]: v }).success, `${name} + ${k}`).toBe(false);
    }
  });
  it("only accepts http(s) links (no javascript: URLs)", () => {
    expect(MaterialSchema.safeParse({ type: "link", title: "T", url: "javascript:alert(1)", branch: "CSE", year: 1 }).success).toBe(false);
    expect(ReportSchema.safeParse({ groupId: uuid, weekNumber: 1, content: "c", attachmentUrl: "data:text/html,x" }).success).toBe(false);
  });
  it("requires the right content per material/post type", () => {
    expect(MaterialSchema.safeParse({ type: "notes", title: "T", branch: "CSE", year: 1 }).success).toBe(false);
    expect(PostSchema.safeParse({ type: "event", title: "t", body: "b" }).success).toBe(false);
  });
});

describe("migrations 038-040 keep every table private and the writes atomic", () => {
  const sql = ["038_org_classroom", "039_org_placements_rls", "040_org_presence"].map((f) => readFileSync(`supabase/migrations/${f}.sql`, "utf8")).join("\n");
  it("enables RLS and revokes client access on every new table; adds no client policy on them", () => {
    for (const t of ["class_materials", "class_projects", "class_project_groups", "class_project_group_members", "class_weekly_reports", "class_submissions", "class_project_grades", "org_profiles", "org_posts", "org_follows", "org_post_likes"]) {
      expect(sql, t).toContain(`'${t}'`);
    }
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.%I from anon, authenticated/);
    expect(sql).not.toMatch(/create policy \w+ on public\.(class_|org_)/);
  });
  it("state-changing functions are service_role only", () => {
    expect(sql).toMatch(/revoke all on function public\.%s from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.%s to service_role/);
  });
  it("only the graded outcome creates evidence (never weekly reports), staff-verified", () => {
    const evidenceInserts = sql.match(/insert into public\.evidence/g) ?? [];
    expect(evidenceInserts).toHaveLength(1);
    expect(sql).toMatch(/'staff_graded_project'/);
    expect(sql).toMatch(/'provenance', 'staff-verified'/);
  });
  it("private placement drives are hidden from non-members", () => {
    expect(sql).toMatch(/institution_id is null\s+or exists/);
    expect(sql).toMatch(/m\.status = 'active'/);
  });
});
