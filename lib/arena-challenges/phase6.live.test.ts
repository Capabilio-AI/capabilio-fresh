import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import { importSpec, markValidated, publishChallenge, retireChallenge, upsertTemplates } from "@/lib/arena-content/store";
import { TemplateSpec } from "@/lib/arena-content/spec";
import { loadRuntimeAdmin, updateRuntimeSettings } from "@/lib/arena-content/runtime-admin";
import { currentWeekStart } from "./week";
import { loadDomainSet } from "./domain-set";
import { ChallengeAttemptError, loadAttemptView, startChallengeAttempt, submitChallengeAttempt } from "./attempts";
import { requestAiHelp } from "./ai-help";
import { resolveStreamScope } from "./resolve-scope";
import { loadStreamPool, loadStreamStudentContext } from "./stream-context";
import { selectStreamBatch } from "./select-stream";

// Live: cost caps, kill switch, AI helper guardrails, and the "Done when" acceptance checks (branch -> stream, career / Plan B -> domain).
const service = liveServiceClient();
const db = untyped(service);
const specKeys: string[] = [];
const users: string[] = [];
let institutionId: string;
let originalSettings: { runtime_type: string; enabled: boolean; max_attempts_per_student_per_day: number; daily_cost_cap_cents_per_student: number; attempt_cost_cents: number }[] = [];

const seed = (file: string, index = 0) => (JSON.parse(readFileSync(`content/arena/seed/${file}`, "utf8")) as Record<string, unknown>[])[index];
async function publishCopy(spec: Record<string, unknown>, key: string, over: Record<string, unknown> = {}) {
  const { id } = await importSpec(service, { ...spec, key, isSeed: false, ...over });
  specKeys.push(key);
  await markValidated(service, { id });
  await publishChallenge(service, { id }, null);
  return id;
}

beforeAll(async () => {
  await upsertTemplates(service, TemplateSpec.array().parse(JSON.parse(readFileSync("content/arena/templates.json", "utf8"))));
  originalSettings = ((await db.from("runtime_settings").select("*")).data ?? []) as typeof originalSettings;
  const { data } = await db.from("institutions").insert({ name: "Live Test Institute", slug: `live-test-${Date.now()}` }).select("id").single();
  institutionId = data!.id;
});
afterAll(async () => {
  for (const s of originalSettings) await db.from("runtime_settings").update({ enabled: s.enabled, max_attempts_per_student_per_day: s.max_attempts_per_student_per_day, daily_cost_cap_cents_per_student: s.daily_cost_cap_cents_per_student, attempt_cost_cents: s.attempt_cost_cents }).eq("runtime_type", s.runtime_type);
  await db.from("arena_challenges").delete().in("spec_key", specKeys);
  for (const u of users) await deleteThrowawayUser(service, u);
  await db.from("institution_memberships").delete().eq("institution_id", institutionId);
  await db.from("institutions").delete().eq("id", institutionId);
});

const newUser = async (label: string) => {
  const id = await createThrowawayUser(service, label);
  users.push(id);
  return id;
};
const makeStudent = async (label: string, branch: string) => {
  const id = await newUser(label);
  const { error } = await db.from("institution_memberships").insert({ user_id: id, institution_id: institutionId, role: "student", status: "active", branch });
  if (error) throw error;
  return id;
};
const careerId = async (key: string) => (await service.from("careers").select("id").eq("key", key).single()).data!.id as string;

describe("acceptance: stream follows the student's branch", () => {
  it("a Civil student sees only Civil challenges and an ECE student only ECE", async () => {
    const civilId = await publishCopy(seed("stream-civil-mech.json", 0), "zz-live-civil", { branches: ["Civil Engineering"] });
    const eceId = await publishCopy(seed("stream-eee-ece-cse.json", 2), "zz-live-ece", { branches: ["Electronics and Communication Engineering (ECE)"] });
    const civil = await makeStudent("civil", "Civil Engineering");
    const ece = await makeStudent("ece", "Electronics and Communication Engineering (ECE)");

    for (const [student, expected, other] of [[civil, civilId, eceId], [ece, eceId, civilId]] as const) {
      const scope = await resolveStreamScope(service, student);
      expect(scope).not.toBeNull();
      const pool = await loadStreamPool(service, scope!);
      const batch = selectStreamBatch({ pool, solvedIds: new Set(), recentIds: new Set(), courses: [], currentYear: null, points: 0, seed: `${student}:week` });
      expect(batch.ids).toContain(expected);
      expect(batch.ids).not.toContain(other);
      expect(batch.shortfall).toBeGreaterThan(0); // honest short batch, no padding from other branches
    }
    await retireChallenge(service, { key: "zz-live-civil" });
    await retireChallenge(service, { key: "zz-live-ece" });
  });
});

describe("acceptance: domain follows the career and Plan B", () => {
  it("changing career or switching to Plan B changes the Domain set", async () => {
    const da = await publishCopy(seed("domain-data-analyst.json", 0), "zz-live-da");
    const ops = await publishCopy(seed("domain-devops.json", 0), "zz-live-ops");
    const student = await newUser("domain");
    await db.from("student_career_intent").insert({ student_id: student, primary_career_id: await careerId("data-analyst"), secondary_career_id: await careerId("cloud-engineer") });

    const ids = async (which: "primary" | "plan-b") => {
      const v = await loadDomainSet(service, student, which);
      if (v.state !== "ready") throw new Error(v.state);
      return v.items.map((i) => i.id);
    };
    // real seeded challenges are published too, so check membership of this test's own challenges
    const primary = await ids("primary");
    expect(primary).toContain(da);
    expect(primary).not.toContain(ops);
    const planB = await ids("plan-b");
    expect(planB).toContain(ops);
    expect(planB).not.toContain(da);
    await db.from("student_career_intent").update({ primary_career_id: await careerId("cloud-engineer"), secondary_career_id: null }).eq("student_id", student);
    const moved = await ids("primary");
    expect(moved).toContain(ops);
    expect(moved).not.toContain(da);
    expect((await loadDomainSet(service, student, "plan-b")).state).toBe("no_plan_b");
    await retireChallenge(service, { key: "zz-live-da" });
    await retireChallenge(service, { key: "zz-live-ops" });
  });
});

describe("runtime switches and cost caps", () => {
  let student: string;
  let challenges: string[];
  beforeAll(async () => {
    const career = "data-analyst";
    void career;
    challenges = [
      await publishCopy(seed("domain-data-analyst.json", 0), "zz-live-cap-1"),
      await publishCopy(seed("domain-data-analyst.json", 1), "zz-live-cap-2"),
      await publishCopy(seed("domain-data-analyst.json", 2), "zz-live-cap-3"),
    ];
    student = await newUser("caps");
    await db.from("student_career_intent").insert({ student_id: student, primary_career_id: await careerId("data-analyst") });
  });

  it("stops starting attempts once the daily cost cap would be exceeded, and reports the spend", async () => {
    const admin = await newUser("admin");
    await updateRuntimeSettings(service, { runtimeType: "SQL_CONSOLE", enabled: true, attemptCostCents: 40, dailyCostCapCentsPerStudent: 100, maxAttemptsPerStudentPerDay: 50 }, admin);
    await startChallengeAttempt(service, student, challenges[0]);
    await startChallengeAttempt(service, student, challenges[1]);
    await expect(startChallengeAttempt(service, student, challenges[2])).rejects.toMatchObject({ status: 429, extra: { reason: "DAILY_COST_LIMIT" } });
    const sql = (await loadRuntimeAdmin(service)).find((r) => r.runtimeType === "SQL_CONSOLE")!;
    expect(sql.costTodayCents).toBeGreaterThanOrEqual(80);
  });

  it("the kill switch blocks new attempts at once and is visible on an open one, which can still be submitted", async () => {
    const admin = await newUser("admin2");
    await updateRuntimeSettings(service, { runtimeType: "SQL_CONSOLE", dailyCostCapCentsPerStudent: 0, attemptCostCents: 0, enabled: true }, admin);
    const open = (await startChallengeAttempt(service, student, challenges[0])).attemptId; // resumes the open one
    await updateRuntimeSettings(service, { runtimeType: "SQL_CONSOLE", enabled: false }, admin);
    await expect(startChallengeAttempt(service, student, challenges[2])).rejects.toMatchObject({ status: 403, extra: { reason: "RUNTIME_DISABLED" } });
    expect((await loadAttemptView(service, student, open)).runtimeEnabled).toBe(false);
    expect(await submitChallengeAttempt(service, student, open, { submission: {} })).toMatchObject({ status: "FAILED" });
    await updateRuntimeSettings(service, { runtimeType: "SQL_CONSOLE", enabled: true }, admin);
  });

  it("a runtime that is not built cannot be switched on", async () => {
    await expect(updateRuntimeSettings(service, { runtimeType: "TERMINAL_VM", enabled: true }, await newUser("admin3"))).rejects.toMatchObject({ status: 409 });
  });
});

describe("AI helper", () => {
  it("explains without leaking, withholds a leaked answer, is capped, and costs score only while the attempt is open", async () => {
    const id = await publishCopy(seed("stream-civil-mech.json", 0), "zz-live-ai-help", { branches: ["Civil Engineering"] });
    const student = await makeStudent("aihelp", "Civil Engineering");
    const { data: wk } = await db.from("arena_stream_weeks").insert({ user_id: student, week_start: currentWeekStart(), scope_key: "x", challenge_ids: [id] }).select("id");
    void wk;
    const { attemptId } = await startChallengeAttempt(service, student, id);

    const calls: string[] = [];
    const fine = async (prompt: string) => (calls.push(prompt), { explanation: "Think about equilibrium: what does each support carry for a symmetric load?" });
    const first = await requestAiHelp(service, student, attemptId, "how do I start?", fine);
    expect(first).toMatchObject({ withheld: false, used: 1, penalty: 5 });
    expect(calls[0]).toContain("<student_question>");
    expect(calls[0]).not.toContain('"expected"');

    const leaky = async () => ({ explanation: "Each support carries 30 kN and the moment is 37.5." });
    const second = await requestAiHelp(service, student, attemptId, "just tell me", leaky);
    expect(second.withheld).toBe(true);
    expect(second.explanation).not.toContain("37.5");

    await requestAiHelp(service, student, attemptId, "", fine);
    await expect(requestAiHelp(service, student, attemptId, "", fine)).rejects.toMatchObject({ status: 409 });

    const failing = async () => {
      throw new Error("groq down");
    };
    await db.from("challenge_attempts").update({ ai_help_uses: 0 }).eq("id", attemptId);
    await expect(requestAiHelp(service, student, attemptId, "", failing)).rejects.toBeInstanceOf(ChallengeAttemptError);
    expect((await db.from("challenge_attempts").select("ai_help_uses").eq("id", attemptId).single()).data?.ai_help_uses).toBe(0); // no reply, no charge

    await db.from("challenge_attempts").update({ ai_help_uses: 2 }).eq("id", attemptId);
    const checks = (await db.from("challenge_checks").select("id, label").eq("challenge_id", id)).data as { id: string; label: string }[];
    const answers = Object.fromEntries(checks.map((c) => [c.id, c.label.startsWith("Reaction") ? "30" : "37.5"]));
    const result = await submitChallengeAttempt(service, student, attemptId, { submission: { answers } });
    expect(result).toMatchObject({ status: "PASSED", score: 90 }); // two AI uses x 5

    const after = await requestAiHelp(service, student, attemptId, "", fine);
    expect(after.penalty).toBe(0); // free after submitting
  });
});
