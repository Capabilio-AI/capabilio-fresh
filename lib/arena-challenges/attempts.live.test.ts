import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { ChallengeAttemptError, loadAttemptView, revealHint, saveDraft, startChallengeAttempt, submitChallengeAttempt } from "./attempts";

// Live: start -> work -> submit -> checks -> evidence, against the real database (throwaway users and content; everything is removed afterwards).
const service = liveServiceClient();
const db = untyped(service);
const challengeIds: string[] = [];
const templateIds: string[] = [];
let careerId: string;
let skillId: string;
let userA: string;
let userB: string;
let templateId: string;
let main: string;

async function makeChallenge(opts: { templateId: string; checks: { check_type: string; label: string; config: object; visible?: boolean; weight?: number }[]; difficulty?: string; hints?: number }) {
  const { data, error } = await db
    .from("arena_challenges")
    .insert({ track: "domain", scope_key: "zz-live-attempts", title: "live attempt test", category: "t", difficulty: opts.difficulty ?? "medium", scenario: "s", objective: "o", language: "none", expected_output: "", source: "CAPABILIO", status: "PUBLISHED", time_limit_minutes: 20, workstation_template_id: opts.templateId, ticket_brief: "brief" })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  challengeIds.push(id);
  await db.from("challenge_careers").insert({ challenge_id: id, career_id: careerId });
  await db.from("arena_challenge_skills").insert({ challenge_id: id, skill_id: skillId, source: "SPEC" });
  await db.from("challenge_steps").insert({ challenge_id: id, step_order: 1, title: "Step one", instruction: "Do it" });
  const { error: checksError } = await db.from("challenge_checks").insert(opts.checks.map((c) => ({ challenge_id: id, visible: true, weight: 1, ...c })));
  if (checksError) throw checksError;
  for (let i = 1; i <= (opts.hints ?? 0); i++) await db.from("challenge_hints").insert({ challenge_id: id, hint_order: i, body: `hint ${i}`, penalty_points: 10 });
  return id;
}

const checkIds = async (challengeId: string) => ((await db.from("challenge_checks").select("id, label").eq("challenge_id", challengeId)).data ?? []) as { id: string; label: string }[];

beforeAll(async () => {
  userA = await createThrowawayUser(service, "attempts-a");
  userB = await createThrowawayUser(service, "attempts-b");
  const { data: reqs } = await service.from("career_skill_requirements").select("career_id, skill_id").limit(1);
  careerId = reqs![0].career_id;
  skillId = reqs![0].skill_id;
  await service.from("student_career_intent").insert({ student_id: userA, primary_career_id: careerId });
  const { data: t } = await db.from("workstation_templates").insert({ key: `zz-live-qf-${Date.now()}`, name: "live qf", runtime_type: "QUESTION_FLOW" }).select("id").single();
  templateId = t!.id;
  templateIds.push(templateId);
  main = await makeChallenge({
    templateId,
    hints: 2,
    checks: [
      { check_type: "NUMERIC_ANSWER", label: "Visible number", config: { expected: 42 } },
      { check_type: "CHOICE_ANSWER", label: "secret choice", config: { correct: "b" }, visible: false },
    ],
  });
});
afterAll(async () => {
  if (challengeIds.length) await db.from("arena_challenges").delete().in("id", challengeIds);
  if (templateIds.length) await db.from("workstation_templates").delete().in("id", templateIds);
  await deleteThrowawayUser(service, userA);
  await deleteThrowawayUser(service, userB);
});

describe("access", () => {
  it("refuses a student whose career is not linked to the challenge", async () => {
    await expect(startChallengeAttempt(service, userB, main)).rejects.toMatchObject({ status: 403 });
  });
  it("refuses a challenge whose workstation is not built yet", async () => {
    const { data: t } = await db.from("workstation_templates").insert({ key: `zz-live-vm-${Date.now()}`, name: "vm", runtime_type: "TERMINAL_VM", resource_limits: { memoryMb: 128, wallTimeSeconds: 60 } }).select("id").single();
    templateIds.push(t!.id);
    const vm = await makeChallenge({ templateId: t!.id, checks: [{ check_type: "TERMINAL_OUTPUT", label: "x", config: { matches: "ok" } }] });
    await expect(startChallengeAttempt(service, userA, vm)).rejects.toMatchObject({ status: 409, extra: { reason: "RUNTIME_NOT_AVAILABLE" } });
  });
});

describe("attempt lifecycle", () => {
  let first: string;

  it("starts, resumes the same attempt, and never leaks answers in the view", async () => {
    const started = await startChallengeAttempt(service, userA, main);
    expect(started.resumed).toBe(false);
    first = started.attemptId;
    expect((await startChallengeAttempt(service, userA, main))).toEqual({ attemptId: first, resumed: true });

    const view = await loadAttemptView(service, userA, first);
    expect(view.checks).toHaveLength(2);
    expect(view.checks.find((c) => !c.visible)?.label).toBeNull();
    expect(JSON.stringify(view)).not.toContain("expected");
    expect(JSON.stringify(view)).not.toContain("hint 1");
    await expect(loadAttemptView(service, userB, first)).rejects.toBeInstanceOf(ChallengeAttemptError);
  });

  it("saves a draft and reveals hints in order, then runs out", async () => {
    await saveDraft(service, userA, first, { text: "work" });
    expect((await loadAttemptView(service, userA, first)).attempt.draft).toEqual({ text: "work" });
    expect((await revealHint(service, userA, first)).body).toBe("hint 1");
    expect((await revealHint(service, userA, first)).body).toBe("hint 2");
    await expect(revealHint(service, userA, first)).rejects.toMatchObject({ status: 409 });
  });

  it("a wrong submission fails without awarding anything, and can be retried", async () => {
    const ids = await checkIds(main);
    const numeric = ids.find((c) => c.label === "Visible number")!.id;
    const result = await submitChallengeAttempt(service, userA, first, { submission: { answers: { [numeric]: 7 } } });
    expect(result).toMatchObject({ status: "FAILED", checksPassed: 0, pointsAwarded: 0, eloDelta: 0, evidenceStatus: null });
    expect(result.results.map((r) => r.label).sort()).toEqual(["Hidden check", "Visible number"]);
    const { data: elo } = await db.from("arena_skill_elo").select("rating").eq("student_id", userA);
    expect(elo).toEqual([]);
  });

  it("a correct submission passes, applies the hint penalty, writes evidence, ELO, capability and an event — once", async () => {
    const second = (await startChallengeAttempt(service, userA, main)).attemptId;
    expect(second).not.toBe(first);
    await revealHint(service, userA, second);
    const ids = await checkIds(main);
    const answers = { [ids.find((c) => c.label === "Visible number")!.id]: "42", [ids.find((c) => c.label === "secret choice")!.id]: "b" };

    const result = await submitChallengeAttempt(service, userA, second, { submission: { answers }, reflection: "did it by hand" });
    expect(result).toMatchObject({ status: "PASSED", score: 90, evidenceStatus: "VERIFIED_AUTOMATED", eloDelta: 11 });

    const { data: elo } = await db.from("arena_skill_elo").select("rating, verified_count").eq("student_id", userA).eq("skill_id", skillId).single();
    expect(elo).toEqual({ rating: 411, verified_count: 1 });
    const { data: evidence } = await service.from("evidence").select("skill, evidence_type").eq("user_id", userA).like("source_identifier", `challenge-attempt:${second}:%`);
    expect(evidence).toHaveLength(1);
    const { data: events } = await db.from("challenge_events").select("event_type, payload").eq("dedupe_key", `attempt:${second}`);
    expect(events).toHaveLength(1);
    expect(events![0]).toMatchObject({ event_type: "CHALLENGE_PASSED", payload: { challengeId: main, awarded: true } });
    const { data: att } = await db.from("challenge_attempts").select("reflection_text, status").eq("id", second).single();
    expect(att).toEqual({ reflection_text: "did it by hand", status: "PASSED" });

    expect((await loadStudentCapabilities(service, userA)).bySkill.get(skillId)?.breakdown.ARENA).toBeGreaterThanOrEqual(1);

    // idempotent: a second submit returns the stored result and awards nothing more
    expect(await submitChallengeAttempt(service, userA, second, { submission: { answers } })).toMatchObject({ status: "PASSED", eloDelta: 11 });
    expect((await db.from("arena_skill_elo").select("rating").eq("student_id", userA).eq("skill_id", skillId).single()).data?.rating).toBe(411);
    await expect(startChallengeAttempt(service, userA, main)).rejects.toMatchObject({ status: 409 });
  });
});

describe("other outcomes", () => {
  it("a pass resting on browser-reported checks locks the challenge but earns no ELO or skill evidence", async () => {
    const id = await makeChallenge({ templateId, checks: [{ check_type: "TEST_RUN", label: "tests green", config: {} }] });
    const attempt = (await startChallengeAttempt(service, userA, id)).attemptId;
    const check = (await checkIds(id))[0].id;
    const result = await submitChallengeAttempt(service, userA, attempt, { submission: { reported: { [check]: true } } });
    expect(result).toMatchObject({ status: "PASSED", evidenceStatus: "UNVERIFIED", pointsAwarded: 0, eloDelta: 0 });
    const { data: ev } = await service.from("evidence").select("id").eq("user_id", userA).like("source_identifier", `challenge-attempt:${attempt}:%`);
    expect(ev).toEqual([]);
    const { data: done } = await service.from("arena_challenge_completions").select("is_correct").eq("user_id", userA).eq("challenge_id", id).single();
    expect(done?.is_correct).toBe(true);
  });

  it("a submission after the deadline expires the attempt with no credit", async () => {
    const id = await makeChallenge({ templateId, checks: [{ check_type: "NUMERIC_ANSWER", label: "n", config: { expected: 1 } }] });
    const attempt = (await startChallengeAttempt(service, userA, id)).attemptId;
    await db.from("challenge_attempts").update({ expires_at: new Date(Date.now() - 120_000).toISOString() }).eq("id", attempt);
    const check = (await checkIds(id))[0].id;
    await expect(saveDraft(service, userA, attempt, { x: 1 })).rejects.toMatchObject({ status: 409 });
    const result = await submitChallengeAttempt(service, userA, attempt, { submission: { answers: { [check]: 1 } } });
    expect(result).toMatchObject({ status: "EXPIRED", pointsAwarded: 0 });
    const { data: done } = await service.from("arena_challenge_completions").select("id").eq("user_id", userA).eq("challenge_id", id);
    expect(done).toEqual([]);
  });
});
