import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { advanceOnboarding, getOnboardingStatus, type Db } from "./db";
import { answerQuestion, getState, nextQuestion, startSession } from "./session";
import { submitSession } from "./finalize";
import { AssessError } from "./types";

// Real database, stored Groq pool (fill it first with `npm run assess:pool -- data-analyst`). No Groq call is made unless the
// pool is short, in which case the bounded live-generation path is exercised.
const service = liveServiceClient();
const db = service as unknown as Db;
let userId = "";
let careerId = "";

/** The test plays the role of "a student who knows the answers": it reads the key with the service role, the client never can. */
async function keyFor(sessionQuestionId: string): Promise<{ correctDisplayed: number; optionCount: number; explanation: string }> {
  const { data: sq } = await db.from("assess_session_questions").select("option_order, pool_question_id").eq("id", sessionQuestionId).single();
  const { data: pool } = await db.from("assess_question_pool").select("correct_index, explanation").eq("id", sq!.pool_question_id).single();
  return { correctDisplayed: (sq!.option_order as number[]).indexOf(pool!.correct_index), optionCount: (sq!.option_order as number[]).length, explanation: pool!.explanation };
}
const eloOf = async () => (await db.from("student_career_elo").select("rating").eq("student_id", userId).eq("career_id", careerId).maybeSingle()).data?.rating ?? null;

beforeAll(async () => {
  userId = await createThrowawayUser(service, "assess");
  careerId = (await db.from("careers").select("id").eq("key", "data-analyst").single()).data!.id;
  await db.from("student_career_intent").upsert({ student_id: userId, primary_career_id: careerId, is_exploring: false }, { onConflict: "student_id" });
}, 60_000);
afterAll(async () => {
  await db.from("product_events").delete().eq("user_id", userId);
  await deleteThrowawayUser(service, userId);
});

describe("gating", () => {
  it("a new student starts at ASSESSMENT_REQUIRED and cannot start the career assessment before the general one", async () => {
    expect(await getOnboardingStatus(db, userId)).toBe("ASSESSMENT_REQUIRED");
    await expect(startSession(db, userId, "CAREER")).rejects.toMatchObject({ code: "GENERAL_REQUIRED" });
  });
  it("onboarding only moves forward", async () => {
    await advanceOnboarding(db, userId, "COMMON_ASSESSMENT_COMPLETE");
    expect(await advanceOnboarding(db, userId, "ASSESSMENT_REQUIRED")).toBe("COMMON_ASSESSMENT_COMPLETE");
  });
});

describe("career assessment: Data Analyst", () => {
  it("runs 20-25 adaptive questions with locked answers, a +4/-2 ELO ledger, resume, and a complete result", async () => {
    const started = await startSession(db, userId, "CAREER");
    expect(started.total).toBeGreaterThanOrEqual(20);
    expect(started.total).toBeLessThanOrEqual(25);
    expect(started.startingElo).toBe(400);
    expect(started.skills).toEqual(expect.arrayContaining(["SQL", "Power BI"]));

    // an unserved (queued) question can't be answered
    const { data: queued } = await db.from("assess_session_questions").select("id").eq("session_id", started.sessionId).eq("state", "QUEUED").limit(1).maybeSingle();
    if (queued) {
      await expect(answerQuestion(db, userId, { sessionQuestionId: queued.id, attemptId: crypto.randomUUID(), optionIndex: 0 })).rejects.toMatchObject({ code: "QUESTION_NOT_SERVED" });
    }

    let elo = 400, correct = 0, incorrect = 0;
    const seenSkills = new Set<string>();
    let state = started.state;
    let first = true;
    for (let i = 0; i < started.total; i++) {
      const q = state.current!.question;
      expect(q.skillName).toBeTruthy(); // skill badge data is always present
      seenSkills.add(q.skillName);
      expect(q.position).toBe(i + 1);
      // answer secrecy: nothing in the payload reveals the key or the explanation
      const key = await keyFor(q.sessionQuestionId);
      const raw = JSON.stringify(q);
      expect(raw).not.toContain(key.explanation);
      expect(Object.keys(q)).not.toEqual(expect.arrayContaining(["correctIndex"]));
      expect(Object.keys(q)).not.toEqual(expect.arrayContaining(["explanation"]));

      const wantRight = i % 4 !== 3; // 3 right, 1 wrong, repeat
      const pick = wantRight ? key.correctDisplayed : (key.correctDisplayed + 1) % key.optionCount;
      const attemptId = crypto.randomUUID();
      const fb = await answerQuestion(db, userId, { sessionQuestionId: q.sessionQuestionId, attemptId, optionIndex: pick, responseMs: 1500 });
      expect(fb.isCorrect).toBe(wantRight);
      expect(fb.correctIndex).toBe(key.correctDisplayed);
      expect(fb.chosenIndex).toBe(pick);
      elo += wantRight ? 4 : -2;
      wantRight ? correct++ : incorrect++;
      expect(fb.elo).toMatchObject({ change: wantRight ? 4 : -2, newRating: elo });
      expect(fb.isLast).toBe(i === started.total - 1);

      if (first) {
        first = false;
        // finality: a second, different choice on the same question changes nothing
        const again = await answerQuestion(db, userId, { sessionQuestionId: q.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: (pick + 1) % key.optionCount });
        expect(again.alreadyAnswered).toBe(true);
        expect(again.chosenIndex).toBe(pick);
        expect(again.elo?.newRating).toBe(elo);
        expect(await eloOf()).toBe(elo);
        // resume after a refresh: still on this question, answered, with locked feedback (not skipped ahead)
        const resumed = await startSession(db, userId, "CAREER");
        expect(resumed.resumed).toBe(true);
        expect(resumed.state.current!.question.sessionQuestionId).toBe(q.sessionQuestionId);
        expect(resumed.state.current!.feedback).toMatchObject({ isCorrect: true, chosenIndex: pick });
      }

      if (i < started.total - 1) {
        await expect(submitSession(db, userId, started.sessionId)).rejects.toMatchObject({ code: "NOT_ALL_ANSWERED" });
        const next = (await nextQuestion(db, userId, started.sessionId)).question;
        expect(next).not.toBeNull();
        state = await getState(db, userId, started.sessionId);
        expect(state.current!.question.sessionQuestionId).toBe(next!.sessionQuestionId);
      }
    }

    expect(await eloOf()).toBe(400 + 4 * correct - 2 * incorrect);
    const { count: events } = await db.from("elo_events").select("id", { count: "exact", head: true }).eq("student_id", userId);
    expect(events).toBe(started.total); // every answer has exactly one ledger row

    // coverage: more than one skill, none over its max
    expect(seenSkills.size).toBeGreaterThanOrEqual(10);

    const result = await submitSession(db, userId, started.sessionId);
    expect(result.elo).toMatchObject({ startingElo: 400, correct, incorrect, newElo: 400 + 4 * correct - 2 * incorrect });
    expect(result.elo!.net).toBe(4 * correct - 2 * incorrect);
    const { data: required } = await db.from("career_skill_requirements").select("skill_id").eq("career_id", careerId);
    expect(result.skills).toHaveLength(required!.length); // every canonical skill is on the radar
    expect(result.skills.some((s) => s.confidence === "INSUFFICIENT" && s.score === null)).toBe(true);
    expect(result.readiness).toBeGreaterThan(0);

    // idempotent submit, snapshot written once, onboarding advanced, capability rows fed
    expect((await submitSession(db, userId, started.sessionId)).completedAt).toBe(result.completedAt);
    const { count: snaps } = await db.from("career_skill_graph_snapshots").select("id", { count: "exact", head: true }).eq("student_id", userId);
    expect(snaps).toBe(1);
    expect(await getOnboardingStatus(db, userId)).toBe("PROFILE_READY");
    const { count: caps } = await db.from("capabilities").select("id", { count: "exact", head: true }).eq("user_id", userId);
    expect(caps).toBeGreaterThan(0);

    // history is append-only
    const upd = await db.from("elo_events").update({ change: 99 }).eq("student_id", userId);
    expect(upd.error).not.toBeNull();
    const del = await db.from("career_skill_graph_snapshots").delete().eq("student_id", userId);
    expect(del.error).not.toBeNull();
  }, 590_000);

  it("a retake continues from the persisted rating, and ELO survives a fresh read", async () => {
    const before = await eloOf();
    const again = await startSession(db, userId, "CAREER");
    expect(again.resumed).toBe(false);
    expect(again.startingElo).toBe(before);
  }, 120_000);
});

describe("ELO engine in the database", () => {
  it("never goes below the floor and is idempotent per source id", async () => {
    const other = (await db.from("careers").select("id").eq("key", "software-engineer").single()).data!.id;
    const sourceId = crypto.randomUUID();
    const a = (await db.rpc("apply_elo_event", { p_student: userId, p_career: other, p_source: "ARENA", p_source_id: sourceId, p_correct: true })).data;
    const b = (await db.rpc("apply_elo_event", { p_student: userId, p_career: other, p_source: "ARENA", p_source_id: sourceId, p_correct: true })).data;
    expect(a).toMatchObject({ previous: 400, newRating: 404, replayed: false }); // a role switch starts at 400, no transfer
    expect(b).toMatchObject({ newRating: 404, replayed: true });
    await db.from("student_career_elo").update({ rating: 1 }).eq("student_id", userId).eq("career_id", other);
    const c = (await db.rpc("apply_elo_event", { p_student: userId, p_career: other, p_source: "ARENA", p_source_id: crypto.randomUUID(), p_correct: false })).data;
    expect(c).toMatchObject({ newRating: 0, change: -1 });
  });
  it("the client roles cannot call the ELO functions", async () => {
    expect(AssessError).toBeDefined();
    const anon = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false }, realtime: { transport: class {} as never } });
    const r = await anon.rpc("apply_elo_event", { p_student: userId, p_career: careerId, p_source: "ASSESSMENT", p_source_id: crypto.randomUUID(), p_correct: true });
    expect(r.error).not.toBeNull();
    const pool = await anon.from("assess_question_pool").select("correct_index").limit(1);
    expect(pool.data ?? []).toHaveLength(0); // the answer key is not readable by clients
  });
});
