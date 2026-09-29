import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { getWorkstationState, startNextAttempt, submitAttempt } from "@/lib/arena-workstations/attempts";
import { referenceSubmission } from "@/lib/arena-workstations/reference-submission";
import { listEnabledRoles } from "@/lib/arena-workstations/taxonomy";
import { getStudentDirection, shouldShowGoalPrompt, shouldShowHigherStudiesCheckin } from "./direction";
import { recordPromptSeen, saveGoalState, switchActiveRole } from "./direction-writes";
import { getAssessmentMode } from "@/lib/assessment/mode";

// The Job-Track walkthrough, live: real DB and real code paths, a disposable student and a
// disposable `test-` Arena role (never served to real students — see taxonomy.ts). Everything
// is deleted in afterAll. Requires LIVE_DB=1 and, for the role, ALLOW_TEST_ROLES=1 (set below).
const service = liveServiceClient();
const TEST_ROLE = "test-walkthrough";
const DAY = 86_400_000;
let userId: string;
let institutionId: string;
const thisYear = new Date().getFullYear();

async function snapshot(role: string) {
  const [rot, rat, comp, ev, asg] = await Promise.all([
    service.from("arena_rotation_state").select("*").eq("user_id", userId).eq("role_key", role).order("role_key"),
    service.from("arena_skill_ratings").select("*").eq("user_id", userId).eq("role_key", role).order("area_key"),
    service.from("arena_attempt_completions").select("*").eq("user_id", userId).eq("role_key", role).order("attempt_id"),
    service.from("evidence").select("*").eq("user_id", userId).order("id"),
    service.from("arena_domain_assignments").select("*").eq("user_id", userId).eq("role_key", role).order("id"),
  ]);
  return JSON.stringify({ rot: rot.data, rat: rat.data, comp: comp.data, ev: ev.data, asg: asg.data });
}

describe("Job-Track walkthrough", () => {
  beforeAll(async () => {
    process.env.ALLOW_TEST_ROLES = "1";
    userId = await createThrowawayUser(service, "walkthrough");
    const { data: inst } = await service.from("institutions").insert({ name: `ZZ WALKTHROUGH ${Date.now()}`, slug: `zz-walk-${Date.now()}` }).select("id").single();
    institutionId = inst!.id;
    await service.from("institution_memberships").insert({ user_id: userId, institution_id: institutionId, role: "student", status: "active", branch: "ZZ", start_year: thisYear - 1, end_year: thisYear + 3 });
  });

  afterAll(async () => {
    delete process.env.ALLOW_TEST_ROLES;
    await deleteThrowawayUser(service, userId); // cascades ratings/rotation/membership rows
    await service.from("arena_skill_areas").delete().eq("role_key", TEST_ROLE);
    await service.from("arena_domain_roles").delete().eq("role_key", TEST_ROLE);
    await service.from("institution_memberships").delete().eq("institution_id", institutionId);
    await service.from("institutions").delete().eq("id", institutionId);
  });

  it("trigger window: end_year − year == 2 is out, == 1 is in, and assessment mode follows", async () => {
    expect((await getStudentDirection(service, userId))?.inDirectionWindow).toBe(false);
    expect(await getAssessmentMode(service, userId)).toBe("full");
    await service.from("institution_memberships").update({ end_year: thisYear + 1 }).eq("user_id", userId);
    const d = await getStudentDirection(service, userId);
    expect(d?.inDirectionWindow).toBe(true);
    expect(await getAssessmentMode(service, userId)).toBe("light");
    expect(shouldShowGoalPrompt(d!)).toBe(true);
  });

  it("all four goal states persist live and drive the track; not_sure/unset behave as job; cadences fire", async () => {
    for (const [state, track] of [["job", "job"], ["higher_studies", "higher_studies"], ["entrepreneur", "entrepreneur"], ["not_sure", "job"]] as const) {
      expect(await saveGoalState(service, userId, state)).toEqual({ ok: true });
      const d = await getStudentDirection(service, userId);
      expect(d?.goalState).toBe(state);
      expect(d?.track).toBe(track);
    }
    const notSure = (await getStudentDirection(service, userId))!;
    expect(shouldShowGoalPrompt(notSure)).toBe(false);
    expect(shouldShowGoalPrompt(notSure, new Date(Date.now() + 14 * DAY + 1000))).toBe(true);
    await saveGoalState(service, userId, "higher_studies");
    const hs = (await getStudentDirection(service, userId))!;
    expect(shouldShowHigherStudiesCheckin(hs)).toBe(false);
    expect(shouldShowHigherStudiesCheckin(hs, new Date(Date.now() + 90 * DAY + 1000))).toBe(true);
    await recordPromptSeen(service, userId, "checkin");
  });

  it("Higher Studies switch retargets the role and leaves every prior evidence row byte-for-byte unchanged", async () => {
    // Real prior evidence under the real role: one AI-generated SQL-workspace task, graded by the real grader.
    const started = await startNextAttempt(service, userId, "Data Analyst");
    expect(started.state).toBe("active");
    if (started.state !== "active") return;
    const { data: instance } = await service.from("arena_challenges").select("answer_key, content, tool_type").eq("id", started.attempt.challenge.id).single();
    const graded = await submitAttempt(service, userId, started.attempt.attemptId, referenceSubmission(instance!.tool_type!, instance!.content, instance!.answer_key));
    expect(graded.passed).toBe(true);
    const before = await snapshot("data-analyst");
    expect(JSON.parse(before).comp).toHaveLength(1);

    // A disposable second role (config-only: rows in arena_domain_roles / arena_skill_areas).
    await service.from("arena_domain_roles").insert({ role_key: TEST_ROLE, display_name: "TEST — walkthrough", parent_skill_name: "Data Analysis", match_keywords: [], enabled: true });
    await service.from("arena_skill_areas").insert({ role_key: TEST_ROLE, area_key: "sql", display_name: "SQL", skill_node_key: "test_walkthrough.sql", tool_type: "sql_workspace", enabled: true, sort_order: 1, generation_version: "sql.gen.v1", grading_version: "sql.grade.v1" });

    await saveGoalState(service, userId, "higher_studies");
    const enabled = (await listEnabledRoles(service)).map((r) => r.role_key);
    expect(enabled).toContain(TEST_ROLE);
    expect(await switchActiveRole(service, userId, TEST_ROLE, enabled)).toEqual({ ok: true });

    const state = await getWorkstationState(service, userId, "Data Analyst");
    expect(state.role.key).toBe(TEST_ROLE);
    expect(await snapshot("data-analyst")).toBe(before); // byte-for-byte

    // New activity accrues under the new role only.
    const next = await startNextAttempt(service, userId, "Data Analyst");
    expect(next.state).toBe("active");
    if (next.state === "active") {
      const { data: inst2 } = await service.from("arena_challenges").select("answer_key, content, tool_type").eq("id", next.attempt.challenge.id).single();
      const done = await submitAttempt(service, userId, next.attempt.attemptId, referenceSubmission(inst2!.tool_type!, inst2!.content, inst2!.answer_key));
      expect(done.passed).toBe(true);
      const { data: newRatings } = await service.from("arena_skill_ratings").select("role_key").eq("user_id", userId).eq("role_key", TEST_ROLE);
      expect(newRatings).toHaveLength(1);
    }
    const afterNew = JSON.parse(await snapshot("data-analyst"));
    expect(afterNew.comp).toHaveLength(1);
    expect(afterNew.rat).toEqual(JSON.parse(before).rat);
    expect(afterNew.rot).toEqual(JSON.parse(before).rot);
  });

  it("without the test opt-in the disposable role is invisible", async () => {
    delete process.env.ALLOW_TEST_ROLES;
    expect((await listEnabledRoles(service)).map((r) => r.role_key)).not.toContain(TEST_ROLE);
    process.env.ALLOW_TEST_ROLES = "1";
  });
});
