import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IN_APP_APPROVABLE_ROLES, PERMISSIONS, allowed, kindOf, landingFor } from "./roles";
import { orgNavFor } from "./nav";
import { postVisibleTo } from "./presence";
import { MIN_COHORT, summarizeCohorts, summarizeProjects } from "./insights";
import { buildAlerts } from "./home";
import { buildFunnel, placementsToCsv, summarizePlacements, type PlacementRecord } from "./outcomes";
import { ApplicationStatusSchema, ApplySchema, ConfirmPlacementSchema, PlacementConsentSchema } from "./schemas";
import { orgNavGroupsFor } from "./nav";
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
    expect(orgNavFor("tpo").map((n) => n.label)).toEqual(["Home", "Placements", "Insights", "Outcomes"]);
    expect(orgNavFor("tpo").map((n) => n.label)).not.toContain("Students"); // TPO works from aggregates + the pipeline
    expect(orgNavFor("staff").map((n) => n.label)).toContain("Students");
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

describe("reference-aligned workspace: grouped nav", () => {
  it("groups follow Visibility / Operations / Intelligence and every route exists as a page", () => {
    for (const kind of ["admin", "staff", "tpo"] as const) {
      const groups = orgNavGroupsFor(kind);
      expect(groups.every((g) => ["Visibility", "Operations", "Intelligence"].includes(g.label))).toBe(true);
      for (const item of groups.flatMap((g) => g.items)) {
        const file = item.href === "/org" ? "app/org/page.tsx" : item.href.startsWith("/admin") ? `app/(app)${item.href}/page.tsx` : `app${item.href}/page.tsx`;
        expect(existsSync(file), `${kind}: ${item.href}`).toBe(true);
      }
    }
  });
  it("the roster is for staff and admins, not the TPO", () => {
    expect(allowed("staff", "viewRoster")).toBe(true);
    expect(allowed("admin", "viewRoster")).toBe(true);
    expect(allowed("tpo", "viewRoster")).toBe(false);
    expect(allowed("student", "viewRoster")).toBe(false);
    expect(allowed("student", "applyToDrive")).toBe(true);
    expect(allowed("tpo", "applyToDrive")).toBe(false);
  });
});

describe("home: what needs attention", () => {
  const none = { pendingMembers: 0, awaitingGrading: 0, applicantsToReview: 0, drivesClosingSoon: 0, projectsClosingWithOpenGroups: 0 };
  it("shows nothing when nothing is waiting — no invented alerts", () => {
    for (const kind of ["admin", "staff", "tpo"] as const) expect(buildAlerts(kind, none)).toEqual([]);
  });
  it("only surfaces items the role can act on", () => {
    const busy = { pendingMembers: 2, awaitingGrading: 3, applicantsToReview: 4, drivesClosingSoon: 1, projectsClosingWithOpenGroups: 1 };
    expect(buildAlerts("tpo", busy).map((a) => a.href)).toEqual(["/org/placements", "/org/placements"]);
    expect(buildAlerts("staff", busy).map((a) => a.href)).toEqual(["/org/projects", "/org/projects"]);
    expect(buildAlerts("admin", busy)).toHaveLength(5);
    expect(buildAlerts("staff", busy).some((a) => a.href === "/org/members")).toBe(false);
  });
  it("uses correct singular/plural copy", () => {
    expect(buildAlerts("staff", { ...none, awaitingGrading: 1 })[0].label).toBe("1 group is waiting for a grade");
    expect(buildAlerts("staff", { ...none, awaitingGrading: 2 })[0].label).toBe("2 groups are waiting for a grade");
  });
});

describe("outcomes: confirmed-only stats with small-number suppression", () => {
  const rec = (i: number, over: Partial<PlacementRecord> = {}): PlacementRecord => ({
    id: `p${i}`, studentUserId: `u${i}`, studentName: `Student ${i}`, branch: i % 2 ? "CSE" : "ECE", company: `Co${i % 3}`, roleTitle: "SWE",
    ctcLpa: 4 + i, offerDate: null, confirmedAt: "2026-09-01T00:00:00Z", showOnWall: false, opportunityId: null, ...over,
  });
  it("hides averages and per-branch counts below 5 records", () => {
    const s = summarizePlacements([rec(1), rec(2), rec(3)]);
    expect(s).toMatchObject({ placed: 3, ctc: null });
    expect(s.byBranch.every((b) => b.count === null)).toBe(true);
  });
  it("computes real figures once there are enough, and counts a twice-placed student once", () => {
    const rows = [rec(1), rec(2), rec(3), rec(4), rec(5), rec(1, { id: "dup", company: "Other", ctcLpa: 30 })];
    const s = summarizePlacements(rows);
    expect(s.placed).toBe(5);
    expect(s.ctc).toEqual({ average: 10.8, median: 7.5, highest: 30 });
    expect(s.byBranch.find((b) => b.branch === "CSE")?.count).toBeNull(); // 3 students -> hidden
  });
  it("funnel counts each applicant at the furthest stage reached; rejected stops at applied", () => {
    expect(buildFunnel(["submitted", "shortlisted", "accepted", "rejected", "accepted"], 1)).toEqual({ applied: 5, shortlisted: 3, selected: 2, placed: 1 });
    expect(buildFunnel([], 0)).toEqual({ applied: 0, shortlisted: 0, selected: 0, placed: 0 });
  });
  it("CSV quotes cells and neutralises spreadsheet formulas", () => {
    const csv = placementsToCsv([rec(1, { studentName: '=HYPERLINK("x")', company: 'A, "B" Ltd' })]);
    const [, row] = csv.split("\n");
    expect(row.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(row).toContain('"A, ""B"" Ltd"');
  });
});

describe("pipeline request bodies are strict", () => {
  const uuid2 = "22222222-2222-4222-8222-222222222222";
  it("rejects statuses outside the pipeline and any smuggled authority field", () => {
    expect(ApplicationStatusSchema.safeParse({ applicationId: uuid2, status: "shortlisted" }).success).toBe(true);
    expect(ApplicationStatusSchema.safeParse({ applicationId: uuid2, status: "hired" }).success).toBe(false);
    expect(ApplicationStatusSchema.safeParse({ applicationId: uuid2, status: "accepted", userId: uuid2 }).success).toBe(false);
    expect(ApplySchema.safeParse({ opportunityId: uuid2, status: "accepted" }).success).toBe(false);
    expect(PlacementConsentSchema.safeParse({ placementId: uuid2, show: true, studentUserId: uuid2 }).success).toBe(false);
  });
  it("a placement is confirmed from an application or a named student — never bare", () => {
    expect(ConfirmPlacementSchema.safeParse({}).success).toBe(false);
    expect(ConfirmPlacementSchema.safeParse({ studentUserId: uuid2 }).success).toBe(false); // needs company + role
    expect(ConfirmPlacementSchema.safeParse({ studentUserId: uuid2, company: "C", roleTitle: "R" }).success).toBe(true);
    expect(ConfirmPlacementSchema.safeParse({ applicationId: uuid2, ctcLpa: 8.5 }).success).toBe(true);
    expect(ConfirmPlacementSchema.safeParse({ applicationId: uuid2, ctcLpa: -1 }).success).toBe(false);
    expect(ConfirmPlacementSchema.safeParse({ applicationId: uuid2, showOnWall: true }).success).toBe(false); // consent is the student's alone
  });
});

describe("migration 041", () => {
  const sql = readFileSync("supabase/migrations/041_org_placement_pipeline.sql", "utf8");
  it("closes client writes to applications and keeps the new tables private", () => {
    expect(sql).toMatch(/revoke insert, update, delete, truncate on public\.applications from anon, authenticated/);
    expect(sql).toMatch(/create policy applications_read_own[\s\S]*for select/);
    expect(sql).toMatch(/revoke all on public\.%I from anon, authenticated/);
    expect(sql).not.toMatch(/create policy \w+ on public\.org_(placements|event_rsvps)/);
  });
  it("defaults the Placement Wall to off", () => {
    expect(sql).toMatch(/show_on_wall boolean not null default false/);
  });
});

describe("migration 042: removal safety", () => {
  const sql = readFileSync("supabase/migrations/042_org_removal_safety.sql", "utf8");
  it("never lets a removed officer's records block their deletion", () => {
    expect(sql).toMatch(/submission_type = 'physical'\)/);
    expect(sql).toMatch(/confirmed_by_membership_id[\s\S]*on delete set null/);
    expect(sql).not.toMatch(/on delete (restrict|no action)/);
  });
});
