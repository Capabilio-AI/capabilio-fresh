import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commitReservedAttempt, reserveNextArea, type ChallengeInstanceInput } from "./rotation-store";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "./live-test-helpers";

const service = liveServiceClient();
const ROLE = "data-analyst";
const AREAS = ["sql", "spreadsheet", "dashboard", "statistics", "data_cleaning"];
let userId: string;

// Structural test payload for the commit function only — never shown to anyone;
// the throwaway user and every row are deleted afterwards.
const payload = (area: string): ChallengeInstanceInput => ({
  title: `rotation test ${area}`,
  category: "test",
  difficulty: "easy",
  time_limit_minutes: 1,
  scenario: "rotation concurrency test",
  objective: "rotation concurrency test",
  requester: "test",
  skill_tags: ["test"],
  tool_type: "test",
  content: {},
  answer_key: {},
  generation_provider: "test",
  generation_model: "test",
  generation_version: "test",
  grading_version: "test",
});

async function closeOpenAttempt() {
  await service.from("arena_domain_assignments").update({ completed_at: new Date().toISOString(), status: "verified" }).eq("user_id", userId).is("completed_at", null);
}

describe("rotation against the real database", () => {
  beforeAll(async () => {
    userId = await createThrowawayUser(service, "rotation");
  });
  afterAll(async () => {
    await deleteThrowawayUser(service, userId);
  });

  it("two concurrent commits for the same reservation create exactly one attempt", async () => {
    const [a, b] = await Promise.all([reserveNextArea(service, userId, ROLE, AREAS), reserveNextArea(service, userId, ROLE, AREAS)]);
    expect(a.areaKey).toBe(b.areaKey);
    expect(a.version).toBe(b.version);

    const results = await Promise.all([commitReservedAttempt(service, userId, ROLE, a, payload(a.areaKey)), commitReservedAttempt(service, userId, ROLE, b, payload(b.areaKey))]);
    expect(results.filter((r) => !r.conflict)).toHaveLength(1);
    expect(results.filter((r) => r.conflict)).toHaveLength(1);

    const { count } = await service.from("arena_domain_assignments").select("id", { count: "exact", head: true }).eq("user_id", userId);
    expect(count).toBe(1);
  });

  it("a reservation that is never committed (failed generation) is not consumed", async () => {
    await closeOpenAttempt();
    const first = await reserveNextArea(service, userId, ROLE, AREAS);
    const again = await reserveNextArea(service, userId, ROLE, AREAS);
    expect(again.areaKey).toBe(first.areaKey);
    expect(again.version).toBe(first.version);
  });

  it("serves all five areas once, then starts a new cycle without an immediate repeat", async () => {
    const served: string[] = [];
    const { data: before } = await service.from("arena_rotation_state").select("served").eq("user_id", userId).single();
    served.push(...(before?.served ?? []));

    while (served.length < AREAS.length) {
      await closeOpenAttempt();
      const r = await reserveNextArea(service, userId, ROLE, AREAS);
      const out = await commitReservedAttempt(service, userId, ROLE, r, payload(r.areaKey));
      expect(out.conflict).toBe(false);
      served.push(r.areaKey);
    }
    expect([...served].sort()).toEqual([...AREAS].sort());

    await closeOpenAttempt();
    const nextCycle = await reserveNextArea(service, userId, ROLE, AREAS);
    expect(nextCycle.cycleNumber).toBe(2);
    expect(nextCycle.areaKey).not.toBe(served[served.length - 1]);
  });

  it("refuses to commit while an attempt is open", async () => {
    const r = await reserveNextArea(service, userId, ROLE, AREAS);
    const first = await commitReservedAttempt(service, userId, ROLE, r, payload(r.areaKey));
    expect(first.conflict).toBe(false);
    const r2 = await reserveNextArea(service, userId, ROLE, AREAS);
    const second = await commitReservedAttempt(service, userId, ROLE, r2, payload(r2.areaKey));
    expect(second.conflict).toBe(true);
  });

  it("challenge instances are immutable once created", async () => {
    const { data } = await service.from("arena_challenges").select("id").eq("user_id", userId).limit(1).single();
    const { error } = await service.from("arena_challenges").update({ title: "tampered" }).eq("id", data!.id);
    expect(error?.message).toMatch(/immutable/);
  });
});
