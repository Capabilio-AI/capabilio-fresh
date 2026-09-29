import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AttemptError, loadOwnedSqlContent, startNextAttempt, submitAttempt } from "./attempts";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "./live-test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Live authorization tests: two candidates, each using a real session with
// the public key — exactly what a browser (or an attacker with devtools) has.
const service = liveServiceClient();
let a: { userId: string; email: string; password: string };
let b: { userId: string; email: string; password: string };
let asA: SupabaseClient<Database>;
let asB: SupabaseClient<Database>;
let attemptId: string;
let challengeId: string;

describe("authorization", () => {
  beforeAll(async () => {
    a = await createThrowawayUserWithLogin(service, "sec-a");
    b = await createThrowawayUserWithLogin(service, "sec-b");
    asA = await signedInClient(a.email, a.password);
    asB = await signedInClient(b.email, b.password);
    const started = await startNextAttempt(service, a.userId, "Data Analyst");
    if (started.state !== "active") throw new Error("expected an active attempt");
    attemptId = started.attempt.attemptId;
    challengeId = started.attempt.challenge.id;
  });
  afterAll(async () => {
    await deleteThrowawayUser(service, a.userId);
    await deleteThrowawayUser(service, b.userId);
  });

  it("candidate B cannot grade, run or read candidate A's attempt through the service layer", async () => {
    await expect(submitAttempt(service, b.userId, attemptId, {})).rejects.toMatchObject({ status: 404 });
    await expect(loadOwnedSqlContent(service, b.userId, attemptId)).rejects.toBeInstanceOf(AttemptError);
  });

  it("candidate B cannot see candidate A's instance, attempt, rating or evidence via the database API", async () => {
    const [instance, attempt, rotation] = await Promise.all([
      asB.from("arena_challenges").select("id, title").eq("id", challengeId),
      asB.from("arena_domain_assignments").select("id").eq("id", attemptId),
      asB.from("arena_rotation_state").select("user_id").eq("user_id", a.userId),
    ]);
    expect(instance.data).toEqual([]);
    expect(attempt.data).toEqual([]);
    expect(rotation.data).toEqual([]);
  });

  it("even the owner cannot read answer keys or Stream expected outputs", async () => {
    const own = await asA.from("arena_challenges").select("id, title, content").eq("id", challengeId);
    expect(own.data).toHaveLength(1);
    const key = await asA.from("arena_challenges").select("answer_key").eq("id", challengeId);
    expect(key.error?.message).toMatch(/permission denied/);
    const stream = await asA.from("arena_challenges").select("expected_output").limit(1);
    expect(stream.error?.message).toMatch(/permission denied/);
  });

  it("nobody can forge a completion, rating or rotation from the client", async () => {
    const forged = await asA.rpc("complete_workstation_attempt", { p_attempt_id: attemptId, p_grade: {}, p_submission: {}, p_points: 1000, p_streak: {}, p_cooldown_hours: 0 });
    expect(forged.error?.message).toMatch(/permission denied/);
    const commit = await asA.rpc("commit_rotation_attempt", { p_user_id: a.userId, p_role_key: "data-analyst", p_area_key: "sql", p_expected_version: 0, p_challenge: {} });
    expect(commit.error?.message).toMatch(/permission denied/);
    const rating = await asA.from("arena_skill_ratings").insert({ user_id: a.userId, role_key: "data-analyst", area_key: "sql", rating: 3000 });
    expect(rating.error).not.toBeNull();
    const selfVerify = await asA.from("arena_domain_assignments").update({ status: "verified" }).eq("id", attemptId).select("id");
    expect(selfVerify.data ?? []).toEqual([]);
    const evidence = await asA.from("evidence").insert({ user_id: a.userId, skill: "SQL", source_type: "arena_challenge", confidence: "high" });
    expect(evidence.error).not.toBeNull();
  });

  it("an invalid submission shape is rejected without consuming the attempt", async () => {
    await expect(submitAttempt(service, a.userId, attemptId, { not: "valid" })).rejects.toMatchObject({ status: 400 });
    const { data } = await service.from("arena_domain_assignments").select("status, completed_at").eq("id", attemptId).single();
    expect(data).toEqual({ status: "presented", completed_at: null });
  });
});
