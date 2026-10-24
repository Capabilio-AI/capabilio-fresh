import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import type { StreamScope } from "../resolve-scope";
import { toMissionRow } from "../stream-ai/personal";
import { buildMission } from "./build";
import { defaultSettings, nearestSolution } from "./grid";
import { labByKey } from "./registry";
import { getMissionState, runMissionTest, takeMissionHint, type MissionView } from "./service";

// Live (needs migration 115): a student plays a mission end to end against the real database.
const service = liveServiceClient();
const db = untyped(service);
const scope: StreamScope = { scopeKey: "branch-zz-live-ece", promptLabel: "Electronics and Communication Engineering", branch: "ZZ Live ECE", branchKey: "zz live ece" };
let userId: string;
let otherId: string;
let challengeId: string;
let scenario: unknown;
let labKey: string;

const ok = (r: unknown): MissionView => {
  if (r && typeof r === "object" && "error" in r) throw new Error(String((r as { error: string }).error));
  return r as MissionView;
};

beforeAll(async () => {
  userId = await createThrowawayUser(service, "mission");
  otherId = await createThrowawayUser(service, "mission-other");
  const draft = await buildMission({ family: "ece", difficulty: "medium", subject: "Analog Circuits", usage: new Map(), avoidTitles: [], seed: 21 }, { llm: async () => { throw new Error("skip ai"); } });
  if (!draft) throw new Error("no mission built");
  scenario = draft.scenario;
  labKey = draft.labKey;
  const { data, error } = await db.from("arena_challenges").insert(toMissionRow(draft, scope, userId, "Analog Circuits")).select("id").single();
  if (error) throw error;
  challengeId = data.id;
});
afterAll(async () => {
  for (const id of [userId, otherId]) {
    await db.from("arena_challenges").delete().eq("user_id", id);
    await db.from("arena_stream_stats").delete().eq("user_id", id);
    await db.from("arena_challenge_completions").delete().eq("user_id", id);
    await deleteThrowawayUser(service, id);
  }
});

describe("mission service", () => {
  it("is private to the student it was written for", async () => {
    expect("error" in (await getMissionState(service, otherId, challengeId))).toBe(true);
  });

  it("opens with no verdict, rejects settings the lab does not offer, and counts tests and different settings", async () => {
    const lab = labByKey(labKey)!;
    const start = ok(await getMissionState(service, userId, challengeId));
    expect(start.outcome).toBeNull();
    expect(start.runs).toBe(0);
    expect(start.requirements.length).toBeGreaterThan(0);
    expect(start.explanation).toBeNull();

    const bad = await runMissionTest(service, userId, challengeId, { nonsense: 1, [lab.controls(scenario)[0].id]: "not-an-option" });
    expect("error" in bad && bad.status).toBe(400);

    const first = ok(await runMissionTest(service, userId, challengeId, defaultSettings(lab.controls(scenario))));
    expect(first.runs).toBe(1);
    expect(first.passed).toBe(false);
    const again = ok(await runMissionTest(service, userId, challengeId, defaultSettings(lab.controls(scenario))));
    expect(again.runs).toBe(2);
    expect(again.distinctRuns).toBe(1); // the same settings are not a new experiment
    expect(again.history).toHaveLength(2); // but every test is in the history, with how many requirements it met (needs migration 116)
    expect(again.history[0].met).toBeLessThan(again.history[0].total);
    expect(again.lab.assumptions.length).toBeGreaterThan(30);
    expect(ok(await getMissionState(service, userId, challengeId)).history).toHaveLength(2); // and it survives a reload
  });

  it("spends hints one at a time up to three and records them", async () => {
    const lab = labByKey(labKey)!;
    const s = defaultSettings(lab.controls(scenario));
    const h = [ok(await takeMissionHint(service, userId, challengeId, s)), ok(await takeMissionHint(service, userId, challengeId, s)), ok(await takeMissionHint(service, userId, challengeId, s))];
    expect(h[2].hintsUsed).toBe(3);
    expect(h[2].hintLog).toHaveLength(3);
    expect("error" in (await takeMissionHint(service, userId, challengeId, s))).toBe(true);
  });

  it("completes exactly once, awards stream points with the hint charge, and refuses further tests", async () => {
    const lab = labByKey(labKey)!;
    const win = nearestSolution(lab, scenario, defaultSettings(lab.controls(scenario)))!;
    const done = ok(await runMissionTest(service, userId, challengeId, win));
    expect(done.passed).toBe(true);
    expect(done.score?.total).toBe(Math.round(60 * 0.55) + (done.distinctRuns >= 3 ? 12 : 0));
    expect(done.explanation).toBeTruthy();

    const { data: stats } = await db.from("arena_stream_stats").select("points, tasks_completed").eq("user_id", userId).single();
    if (!stats) throw new Error("no stats row");
    expect(stats.points).toBe(done.score!.total);
    expect(stats.tasks_completed).toBe(1);
    const { data: completion } = await db.from("arena_challenge_completions").select("is_correct, elo_delta, track").eq("user_id", userId).eq("challenge_id", challengeId).single();
    expect(completion).toEqual({ is_correct: true, elo_delta: done.score!.total, track: "stream" });

    const second = await runMissionTest(service, userId, challengeId, win);
    expect("error" in second && second.status).toBe(409);
    const { data: after } = await db.from("arena_stream_stats").select("points").eq("user_id", userId).single();
    expect(after?.points).toBe(stats.points); // never paid twice
  });
});
