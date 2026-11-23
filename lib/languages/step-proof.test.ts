import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pythonTrack } from "@/lib/languages/python";
import { allLessons } from "./types";
import { finishStepIfReady, firstOpenStep, isStepOpen, recordAnswer, stepState } from "./step-proof";

const qs = (...answers: number[]) => answers.map((answerIndex) => ({ answerIndex }));

describe("stepState", () => {
  it("is complete when every question is answered and there is no coding challenge", () => {
    expect(stepState({ questions: qs(1, 2, 3), answers: { "0": 1, "1": 0, "2": 3 }, hasChallenge: false, challengePassed: false })).toEqual({ answered: 3, correct: 2, total: 3, checkDone: true, challenge: "none", complete: true });
  });
  it("is not complete while the coding challenge is open, even with every answer in", () => {
    const s = stepState({ questions: qs(1, 2), answers: { "0": 1, "1": 2 }, hasChallenge: true, challengePassed: false });
    expect(s).toMatchObject({ checkDone: true, challenge: "open", complete: false });
  });
  it("is complete once the challenge is passed too", () => {
    expect(stepState({ questions: qs(1, 2), answers: { "0": 1, "1": 0 }, hasChallenge: true, challengePassed: true })).toMatchObject({ challenge: "passed", complete: true, correct: 1 });
  });
  it("counts only answers that are real options, and never completes with a question unanswered", () => {
    const s = stepState({ questions: qs(1, 2, 3), answers: { "0": 1, "1": 9, "2": -1, "7": 2 }, hasChallenge: false, challengePassed: false });
    expect(s).toMatchObject({ answered: 1, checkDone: false, complete: false });
    expect(stepState({ questions: [], answers: {}, hasChallenge: false, challengePassed: false }).complete).toBe(false);
  });
});

describe("isStepOpen and firstOpenStep", () => {
  const m = pythonTrack.modules[0];
  const done = (n: number) => Object.fromEntries(m.lessons.slice(0, n).map((l) => [l.key, { correct: 1, total: 1, completedAt: "x" }]));
  it("opens the first step always, and each later step only after the one before it", () => {
    expect(isStepOpen(m, m.lessons[0].key, {})).toBe(true);
    expect(isStepOpen(m, m.lessons[1].key, {})).toBe(false);
    expect(isStepOpen(m, m.lessons[1].key, done(1))).toBe(true);
    expect(isStepOpen(m, m.lessons[2].key, done(1))).toBe(false);
  });
  it("never opens a lesson that is not in the module", () => {
    expect(isStepOpen(m, "no-such-lesson", done(5))).toBe(false);
  });
  it("sends a learner to the first step they have not finished, or the last when all are done", () => {
    expect(firstOpenStep(m, {})).toBe(m.lessons[0].key);
    expect(firstOpenStep(m, done(2))).toBe(m.lessons[2].key);
    expect(firstOpenStep(m, done(m.lessons.length))).toBe(m.lessons[m.lessons.length - 1].key);
  });
});

type Row = { answers: Record<string, number>; updated_at: string };
/** An in-memory stand-in for the two tables, with the conditional update the real one has. */
function fakeDb(opts: { dropFirstUpdate?: boolean } = {}) {
  let row: Row | null = null;
  const progress: Record<string, unknown>[] = [];
  let drop = opts.dropFirstUpdate;
  const answers = {
    select: () => { const q = { eq: () => q, maybeSingle: () => Promise.resolve({ data: row, error: null }) }; return q; },
    insert: (v: { answers: Record<string, number> }) => { if (row) return Promise.resolve({ error: { code: "23505", message: "dup" } }); row = { answers: v.answers, updated_at: "t0" }; return Promise.resolve({ error: null }); },
    update: (v: { answers: Record<string, number> }) => {
      const conds: [string, unknown][] = [];
      const q = { eq: (k: string, val: unknown) => { conds.push([k, val]); return q; }, select: () => {
        if (drop) { drop = false; row = row && { ...row, updated_at: "changed-by-someone-else" }; return Promise.resolve({ data: [], error: null }); }
        const stale = conds.find(([k]) => k === "updated_at");
        if (!row || (stale && stale[1] !== row.updated_at)) return Promise.resolve({ data: [], error: null });
        row = { answers: v.answers, updated_at: `t${Object.keys(v.answers).length}` };
        return Promise.resolve({ data: [{ lesson_key: "x" }], error: null });
      } };
      return q;
    },
  };
  const prog = { upsert: (v: Record<string, unknown>) => { if (!progress.some((p) => p.lesson_key === v.lesson_key)) progress.push(v); return Promise.resolve({ error: null }); } };
  const service = { from: (t: string) => (t === "language_step_answers" ? answers : prog) } as unknown as SupabaseClient;
  return { service, progress, get answers() { return row?.answers ?? {}; } };
}

describe("recordAnswer", () => {
  it("records answers and keeps the FIRST answer to a question", async () => {
    const db = fakeDb();
    await recordAnswer(db.service, "u1", "python", "l1", 0, 2);
    const after = await recordAnswer(db.service, "u1", "python", "l1", 0, 3);
    expect(after["0"]).toBe(2);
    expect(db.answers["0"]).toBe(2);
    await recordAnswer(db.service, "u1", "python", "l1", 1, 1);
    expect(db.answers).toEqual({ "0": 2, "1": 1 });
  });
  it("does not lose an answer when another write lands at the same moment", async () => {
    const db = fakeDb({ dropFirstUpdate: true });
    await recordAnswer(db.service, "u1", "python", "l1", 0, 1);
    await recordAnswer(db.service, "u1", "python", "l1", 1, 2);
    expect(db.answers).toEqual({ "0": 1, "1": 2 });
  });
});

describe("finishStepIfReady", () => {
  const lesson = allLessons(pythonTrack)[0];
  const n = lesson.lesson.check.length;
  const answerAll = async (db: ReturnType<typeof fakeDb>, right: boolean) => { for (let i = 0; i < n; i++) await recordAnswer(db.service, "u1", "python", lesson.key, i, right ? lesson.lesson.check[i].answerIndex : (lesson.lesson.check[i].answerIndex + 1) % 4); };
  it("saves the step as done, with a score the server computed, once the questions are in and the challenge is passed", async () => {
    const db = fakeDb();
    await answerAll(db, true);
    const s = await finishStepIfReady(db.service, "u1", pythonTrack, lesson.key, { hasChallenge: true, passed: true });
    expect(s.complete).toBe(true);
    expect(db.progress).toHaveLength(1);
    expect(db.progress[0]).toMatchObject({ lesson_key: lesson.key, correct: n, total: n });
  });
  it("does not finish the step while the coding challenge is not passed", async () => {
    const db = fakeDb();
    await answerAll(db, true);
    expect((await finishStepIfReady(db.service, "u1", pythonTrack, lesson.key, { hasChallenge: true, passed: false })).complete).toBe(false);
    expect(db.progress).toHaveLength(0);
  });
  it("does not finish the step while a question is unanswered, whatever the challenge says", async () => {
    const db = fakeDb();
    await recordAnswer(db.service, "u1", "python", lesson.key, 0, 0);
    expect((await finishStepIfReady(db.service, "u1", pythonTrack, lesson.key, { hasChallenge: false, passed: false })).complete).toBe(false);
    expect(db.progress).toHaveLength(0);
  });
  it("closes a lesson that has no coding challenge by its questions alone, and writes it once however often it is asked", async () => {
    const db = fakeDb();
    await answerAll(db, false);
    await finishStepIfReady(db.service, "u1", pythonTrack, lesson.key, { hasChallenge: false, passed: false });
    await finishStepIfReady(db.service, "u1", pythonTrack, lesson.key, { hasChallenge: false, passed: false });
    expect(db.progress).toHaveLength(1);
    expect(db.progress[0]).toMatchObject({ correct: 0, total: n });
  });
});
