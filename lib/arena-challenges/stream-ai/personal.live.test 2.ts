import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import type { StreamScope } from "../resolve-scope";
import { loadStreamPool } from "../stream-context";
import { getOrAssignWeeklyBatch } from "../weekly-batch";
import { currentStreamWeek } from "../week";
import { generatePersonal, personalRunKey, preparePersonalPool } from "./personal";

// Live (needs migrations 114 and 115): real model, real database. A non-IT student gets challenges written for them, private to them, served from their weekly batch.
const service = liveServiceClient();
const db = untyped(service);
let userId: string;
let otherId: string;
const scope: StreamScope = { scopeKey: "branch-zz-live-mechanical", promptLabel: "Mechanical Engineering", branch: "ZZ Live Mechanical", branchKey: "zz live mechanical" };
const student = { currentYear: 2, courses: [{ title: "Thermodynamics", year: 2 }, { title: "Fluid Mechanics", year: 2 }] };

beforeAll(async () => {
  userId = await createThrowawayUser(service, "stream-ai");
  otherId = await createThrowawayUser(service, "stream-ai-other");
});
afterAll(async () => {
  for (const id of [userId, otherId]) {
    await db.from("arena_challenges").delete().eq("user_id", id);
    await db.from("arena_stream_weeks").delete().eq("user_id", id);
    await db.from("arena_weekly_generation").delete().eq("scope_key", personalRunKey(id));
    await deleteThrowawayUser(service, id);
  }
});

describe("personal Stream pool", () => {
  it("writes challenges for one student, stores them privately and serves them in the weekly batch", async () => {
    const args = { userId, scope, student, count: 4, points: 0 };
    const first = await preparePersonalPool(service, args);
    expect(first.preparing).toBe(true);
    expect(first.start).toBeTypeOf("function");

    const added = await generatePersonal(service, args, ["medium", "easy", "easy"]);
    expect(added).toBeGreaterThanOrEqual(2);

    const mine = await loadStreamPool(service, scope, userId);
    expect(mine.length).toBe(added);
    expect((await loadStreamPool(service, scope, otherId)).length).toBe(0); // private to this student
    const { data: rows } = await db.from("arena_challenges").select("kind, status, active, user_id, expected_output, options, course_tags, branch_keys").eq("user_id", userId);
    for (const r of rows as { kind: string; status: string; active: boolean; user_id: string; expected_output: string; options: unknown; course_tags: string[]; branch_keys: string[] }[]) {
      expect(["numeric", "mcq", "mission"]).toContain(r.kind); // Mechanical has labs, so most slots are missions
      expect(r.status).toBe("PUBLISHED");
      expect(r.active).toBe(true);
      expect(r.branch_keys).toEqual([scope.branchKey]);
      expect(r.kind === "mcq" ? Array.isArray(r.options) : r.options === null).toBe(true);
    }

    const batch = await getOrAssignWeeklyBatch(service, userId, scope, student, 4);
    expect(batch.weekStart).toBe(currentStreamWeek());
    expect(batch.challengeIds.length).toBe(added);
  });

  it("does not start a second run while the first is claimed", async () => {
    const run = await db.from("arena_weekly_generation").select("status").eq("scope_key", personalRunKey(userId)).maybeSingle();
    expect(["DONE", "FAILED"]).toContain(run.data?.status);
    const again = await preparePersonalPool(service, { userId, scope, student, count: 4, points: 0 });
    expect(again.preparing).toBe(false); // the week's batch is already fixed
  });
});
