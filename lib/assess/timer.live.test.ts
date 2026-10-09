import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { advanceOnboarding, type Db } from "./db";
import { answerQuestion, nextQuestion, startSession } from "./session";

// Real database. The 45-second limit is enforced by the database, so a client that never fires its timer (or pauses it) cannot beat it.
const service = liveServiceClient();
const db = service as unknown as Db;
let userId = "";

beforeAll(async () => {
  userId = await createThrowawayUser(service, "timer");
  const { data: c } = await db.from("careers").select("id").eq("key", "data-analyst").single();
  await db.from("student_career_intent").upsert({ student_id: userId, primary_career_id: c!.id, is_exploring: false }, { onConflict: "student_id" });
  await advanceOnboarding(db, userId, "COMMON_ASSESSMENT_COMPLETE");
}, 60_000);
afterAll(async () => {
  await db.from("product_events").delete().eq("user_id", userId);
  await deleteThrowawayUser(service, userId);
});

describe("question time limit", () => {
  it("a question starts with ~45 seconds, a timed-out answer counts as incorrect (-2), and a late pick is treated the same", async () => {
    const started = await startSession(db, userId, "CAREER");
    const q1 = started.state.current!.question;
    expect(q1.secondsLeft).toBeGreaterThan(35);
    expect(q1.secondsLeft).toBeLessThanOrEqual(45);

    // the client's clock ran out
    const t1 = await answerQuestion(db, userId, { sessionQuestionId: q1.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: -1 });
    expect(t1).toMatchObject({ timedOut: true, isCorrect: false, chosenIndex: -1 });
    expect(t1.elo).toMatchObject({ previous: 400, change: -2, newRating: 398 });
    expect(t1.correctIndex).toBeGreaterThanOrEqual(0); // the right answer is revealed
    // final: a later real pick cannot undo it
    const again = await answerQuestion(db, userId, { sessionQuestionId: q1.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: t1.correctIndex });
    expect(again).toMatchObject({ alreadyAnswered: true, timedOut: true, isCorrect: false });
    expect(again.elo?.newRating).toBe(398);

    // a correct pick that arrives after the limit (+ grace) is still a timeout: the student cannot pause the client to think longer
    const q2 = (await nextQuestion(db, userId, started.sessionId)).question!;
    await db.from("assess_session_questions").update({ served_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", q2.sessionQuestionId);
    const { data: sq } = await db.from("assess_session_questions").select("option_order, pool_question_id").eq("id", q2.sessionQuestionId).single();
    const { data: pool } = await db.from("assess_question_pool").select("correct_index").eq("id", sq!.pool_question_id).single();
    const late = await answerQuestion(db, userId, { sessionQuestionId: q2.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: (sq!.option_order as number[]).indexOf(pool!.correct_index) });
    expect(late).toMatchObject({ timedOut: true, isCorrect: false });
    expect(late.elo).toMatchObject({ change: -2, newRating: 396 });

    // an on-time answer is unaffected, and an out-of-range option is still rejected
    const q3 = (await nextQuestion(db, userId, started.sessionId)).question!;
    expect(q3.secondsLeft).toBeGreaterThan(35);
    await expect(answerQuestion(db, userId, { sessionQuestionId: q3.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: 9 })).rejects.toMatchObject({ code: "INVALID_OPTION" });
  }, 120_000);
});
