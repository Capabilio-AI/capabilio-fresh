import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { advanceOnboarding, type Db } from "./db";
import { mockAdapter, setAdapterForTest } from "@/lib/ai/llm";
import { storeQuestions, topUp, type CareerSlot } from "./generate";
import { nextQuestion, startSession } from "./session";
import { PoolUnavailableError } from "./types";
import type { ValidQuestion } from "./validate";

const service = liveServiceClient();
const db = service as unknown as Db;
let userId = "";
let designer: CareerSlot;

const unique = Date.now().toString(36);
const q: ValidQuestion = {
  question: `A product designer in test run ${unique} compares two checkout flows by task completion time. Which finding is the strongest evidence?`,
  options: ["Median completion time fell by 20% across 200 sessions", "Two testers said it felt faster", "The new flow has fewer screens", "A stakeholder prefers it"],
  correctIndex: 0, skill: "Usability Testing", skillId: "SKILL_USABILITY_TESTING", careerRole: "Product Designer", difficulty: "MEDIUM", type: "decision",
  explanation: "Measured completion time over many sessions is direct, quantitative evidence; opinions and screen counts are not.", estimatedTimeSeconds: 45,
};

beforeAll(async () => {
  userId = await createThrowawayUser(service, "pool");
  const { data: career } = await db.from("careers").select("id, key, name").eq("key", "product-designer").single();
  const { data: skill } = await db.from("skills").select("id, key, name, category").eq("key", "SKILL_USABILITY_TESTING").single();
  designer = { kind: "CAREER", careerId: career!.id, careerKey: career!.key, careerName: career!.name, skillId: skill!.id, skillKey: skill!.key, skillName: skill!.name, skillDescription: null, category: skill!.category };
  await db.from("student_career_intent").upsert({ student_id: userId, primary_career_id: career!.id, is_exploring: false }, { onConflict: "student_id" });
  await advanceOnboarding(db, userId, "COMMON_ASSESSMENT_COMPLETE");
}, 60_000);
afterAll(async () => {
  setAdapterForTest("mock", null);
  await db.from("assess_question_pool").delete().ilike("question_text", `%test run ${unique}%`);
  await deleteThrowawayUser(service, userId);
});

describe("question pool", () => {
  it("stores a validated question once and dedupes the same stem across students and batches", async () => {
    expect(await storeQuestions(db, designer, [q], { provider: "test", model: "test-model", promptVersion: "t.v1" })).toBe(1);
    expect(await storeQuestions(db, designer, [q], { provider: "test", model: "test-model", promptVersion: "t.v1" })).toBe(0);
    expect(await storeQuestions(db, designer, [{ ...q, options: [...q.options].reverse(), correctIndex: 3 }], { provider: "test", model: "test-model", promptVersion: "t.v1" })).toBe(0); // reworded options are not a new question
    const { data } = await db.from("assess_question_pool").select("source, model, version, content_hash, skill_id").ilike("question_text", `%test run ${unique}%`);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ source: "groq", provider: "test", model: "test-model", prompt_version: "t.v1", version: 1, skill_id: designer.skillId });
  });

  it("when Groq is down it falls back to the stored pool, and when the pool has nothing it asks the student to retry without losing the session", async () => {
    setAdapterForTest("mock", mockAdapter(() => { throw Object.assign(new Error("rate limited"), { kind: "rate_limit", retryable: true }); }));
    const down = { env: { LLM_PROVIDER: "mock", LLM_MODEL: "m" }, sleep: async () => {}, random: () => 0, attempts: 1 };
    // 1) a generation attempt against a dead Groq reports unavailability and stores nothing
    await expect(topUp(db, designer, "HARD", 1, { rounds: 1, deps: down })).rejects.toBeTruthy();

    // 2) product-designer has (almost) no stored questions, so serving fails softly; the open session is kept for the retry
    let session: Awaited<ReturnType<typeof startSession>> | null = null;
    try {
      session = await startSession(db, userId, "CAREER", {}, { retry: down });
    } catch (e) {
      expect(e).toBeInstanceOf(PoolUnavailableError);
      expect(e).toMatchObject({ code: "POOL_UNAVAILABLE", status: 503 });
    }
    const { data: open } = await db.from("assess_sessions").select("id, status").eq("student_id", userId).eq("layer", "CAREER").eq("status", "IN_PROGRESS");
    expect(open).toHaveLength(1);
    if (session === null) {
      await expect(nextQuestion(db, userId, open![0].id, { retry: down })).rejects.toBeInstanceOf(PoolUnavailableError);
    } else {
      // the pool did hold something for this role: the fallback served a stored Groq question while Groq was down
      expect(session.state.current?.question.skillName).toBeTruthy();
    }
    const { count } = await db.from("assess_responses").select("id", { count: "exact", head: true }).eq("session_id", open![0].id);
    expect(count).toBe(0);
  }, 120_000);
});
