import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { saveCareerIntent } from "@/lib/careers/intent";
import { untyped } from "@/lib/org/db";
import { DiagnosticError, answerDiagnostic, getDiagnostic, skipDiagnostic, startDiagnostic } from "./diagnostic-store";
import type { Response, StoredKey } from "./diagnostic";
import { getRoadmapGraph } from "./service";

// Live: the whole baseline check against the real published items. Answers are derived from the stored keys (the browser never sees them).
const service = liveServiceClient();
const db = untyped(service);
let userId = "";
let careerId = "";

beforeAll(async () => {
  ({ userId } = await createThrowawayUserWithLogin(service, "diag"));
  careerId = (await service.from("careers").select("id").eq("key", "data-analyst").single()).data!.id;
  await saveCareerIntent(service, userId, { primaryCareerId: careerId, secondaryCareerId: null, isExploring: false });
}, 60_000);
afterAll(async () => {
  await deleteThrowawayUser(service, userId);
});

async function keyOf(itemId: string) {
  const { data } = await db.from("diagnostic_items").select("kind, answer_key, options").eq("id", itemId).single();
  return data as { kind: "MCQ" | "MULTI_SELECT" | "NUMERIC"; answer_key: StoredKey; options: string[] | null };
}
const right = (k: Awaited<ReturnType<typeof keyOf>>): Response => (k.kind === "NUMERIC" ? { value: (k.answer_key as { value: number }).value } : k.kind === "MCQ" ? { choice: (k.answer_key as { correct: number }).correct } : { choices: (k.answer_key as { correct: number[] }).correct });
const wrong = (k: Awaited<ReturnType<typeof keyOf>>): Response => (k.kind === "NUMERIC" ? { value: (k.answer_key as { value: number }).value + 1000 } : k.kind === "MCQ" ? { choice: ((k.answer_key as { correct: number }).correct + 1) % (k.options?.length ?? 2) } : { choices: [] });

describe("the baseline check (live)", () => {
  it("starts with the topics it will cover, and never exposes an answer key", async () => {
    const before = await getDiagnostic(service, userId, careerId);
    expect(before.state).toBe("NOT_STARTED");
    expect(before.covers!.length).toBeGreaterThan(0);
    const started = await startDiagnostic(service, userId, careerId);
    expect(started.state).toBe("IN_PROGRESS");
    expect(started.question).toMatchObject({ difficulty: "medium" });
    expect(JSON.stringify(started)).not.toMatch(/answer_key|correct/);
    expect((await startDiagnostic(service, userId, careerId)).sessionId).toBe(started.sessionId); // resumable, one open session
  });

  it("only accepts an answer to the question it is waiting for", async () => {
    const q = (await getDiagnostic(service, userId, careerId)).question!;
    const other = (await db.from("diagnostic_items").select("id").neq("id", q.id).limit(1).single()).data!.id as string;
    await expect(answerDiagnostic(service, userId, careerId, other, { choice: 0 })).rejects.toMatchObject({ status: 409 });
  });

  it("runs to completion, grades on the server, and records ordinary assessment evidence", async () => {
    let snap = await getDiagnostic(service, userId, careerId);
    let asked = 0;
    while (snap.state === "IN_PROGRESS" && snap.question && asked < 60) {
      const k = await keyOf(snap.question.id);
      // answer the first skill wrongly, everything else rightly
      const isFirstSkill = snap.progress!.skillsDone === 0;
      const out = await answerDiagnostic(service, userId, careerId, snap.question.id, isFirstSkill ? wrong(k) : right(k));
      expect(out.correct).toBe(!isFirstSkill);
      snap = out.snapshot;
      asked += 1;
    }
    expect(snap.state).toBe("COMPLETED");
    expect(snap.results!.length).toBeGreaterThan(1);
    const [first, ...rest] = snap.results!;
    expect(first.level).toBe(0); // answered, and wrong: an assessed zero, distinct from "not assessed"
    expect(rest.every((r) => r.level >= 71)).toBe(true);
    // a finished check can't be answered again
    await expect(answerDiagnostic(service, userId, careerId, "00000000-0000-0000-0000-000000000000", { choice: 0 })).rejects.toBeInstanceOf(DiagnosticError);
  });

  it("shows up on the roadmap: assessed topics now have levels and verified evidence, untouched ones stay not assessed", async () => {
    const r = await getRoadmapGraph(service, userId, "primary");
    if (!r.ok) throw new Error("no roadmap");
    const topics = r.graph.nodes.filter((n) => n.type === "TOPIC");
    const assessed = topics.filter((t) => t.level !== null);
    expect(assessed.length).toBeGreaterThan(1);
    expect(assessed.every((t) => t.verified)).toBe(true);
    expect(topics.some((t) => t.level === null && t.status === "NOT_ASSESSED")).toBe(true);
    expect(r.graph.header.assessedTopics).toBe(assessed.length);
    expect(assessed.some((t) => t.level === 0)).toBe(true);
  });

  it("skipping records the decision and writes no evidence", async () => {
    const { userId: other } = await createThrowawayUserWithLogin(service, "diag2");
    try {
      await saveCareerIntent(service, other, { primaryCareerId: careerId, secondaryCareerId: null, isExploring: false });
      await skipDiagnostic(service, other, careerId);
      expect((await getDiagnostic(service, other, careerId)).state).toBe("SKIPPED");
      expect((await service.from("capabilities").select("id").eq("user_id", other)).data).toEqual([]);
      const r = await getRoadmapGraph(service, other, "primary");
      if (!r.ok) throw new Error("no roadmap");
      expect(r.graph.header.assessedTopics).toBe(0);
    } finally {
      await deleteThrowawayUser(service, other);
    }
  });

  it("says why when no check is available", async () => {
    expect(await getDiagnostic(service, userId, null)).toMatchObject({ state: "UNAVAILABLE", reason: "NO_CAREER" });
    const designer = (await service.from("careers").select("id").eq("key", "product-designer").single()).data!.id;
    expect(await getDiagnostic(service, userId, designer)).toMatchObject({ state: "UNAVAILABLE", reason: "NO_TEMPLATE" });
  });
});
