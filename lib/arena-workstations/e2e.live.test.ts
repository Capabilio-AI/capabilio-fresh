import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getWorkstationState, startNextAttempt, submitAttempt, AttemptError } from "./attempts";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "./live-test-helpers";
import { referenceSubmission } from "./reference-submission";

// §62 acceptance flow, live: real DB, real AI provider, real graders.
const service = liveServiceClient();
const ENABLED = ["sql", "spreadsheet", "dashboard", "statistics", "data_cleaning"];
let userId: string;

async function answerKeyFor(challengeId: string) {
  const { data } = await service.from("arena_challenges").select("answer_key, content, tool_type").eq("id", challengeId).single();
  return data!;
}

async function skipCooldown() {
  await service.from("arena_domain_assignments").update({ next_available_at: new Date(Date.now() - 1000).toISOString() }).eq("user_id", userId);
}

describe("Data Analyst end-to-end", () => {
  beforeAll(async () => {
    userId = await createThrowawayUser(service, "e2e");
  });
  afterAll(async () => {
    await deleteThrowawayUser(service, userId);
  });

  it("serves every skill area once, grades deterministically, updates the right sub-skill once, writes evidence", async () => {
    const before = await getWorkstationState(service, userId, "Data Analyst");
    expect(before.state).toBe("ready");

    const served: string[] = [];
    for (let i = 0; i < ENABLED.length; i++) {
      const started = await startNextAttempt(service, userId, "Data Analyst");
      expect(started.state).toBe("active");
      if (started.state !== "active") return;
      const { attempt } = started;
      const area = attempt.area.key!;
      expect(served).not.toContain(area); // no repeat within a cycle
      served.push(area);

      // Public payload never carries the answer key.
      expect(JSON.stringify(attempt)).not.toContain("answer_key");

      const instance = await answerKeyFor(attempt.challenge.id);
      const wrong = await submitAttempt(service, userId, attempt.attemptId, instance.tool_type === "sql_workspace" ? { query: "SELECT 1" } : instance.tool_type === "cleaning_workspace" ? { steps: [] } : instance.tool_type === "spreadsheet_workspace" ? { cells: {} } : instance.tool_type === "statistics_workspace" ? { answers: {} } : { spec: { chart_type: "pie", dimension: "nope", measure: null, aggregation: "count", filters: [], sort: "dimension_asc", limit: null, dimension_grain: "value" } });
      expect(wrong.passed).toBe(false);

      const { data: ratingBefore } = await service.from("arena_skill_ratings").select("rating, verified_count").eq("user_id", userId).eq("area_key", area).maybeSingle();
      const right = await submitAttempt(service, userId, attempt.attemptId, referenceSubmission(instance.tool_type!, instance.content, instance.answer_key));
      expect(right.passed).toBe(true);

      const { data: ratingAfter } = await service.from("arena_skill_ratings").select("rating, verified_count").eq("user_id", userId).eq("area_key", area).single();
      expect(ratingAfter!.verified_count).toBe((ratingBefore?.verified_count ?? 0) + 1);
      expect(ratingAfter!.rating).toBeGreaterThan(ratingBefore?.rating ?? 1200);

      // Exactly once: a replayed completion changes nothing; a resubmission is refused.
      const { data: replay } = await service.rpc("complete_workstation_attempt", { p_attempt_id: attempt.attemptId, p_grade: {}, p_submission: {}, p_points: 999, p_streak: {}, p_cooldown_hours: 24 });
      expect((replay as { already_completed: boolean }).already_completed).toBe(true);
      await expect(submitAttempt(service, userId, attempt.attemptId, referenceSubmission(instance.tool_type!, instance.content, instance.answer_key))).rejects.toBeInstanceOf(AttemptError);
      const { data: ratingReplay } = await service.from("arena_skill_ratings").select("rating, verified_count").eq("user_id", userId).eq("area_key", area).single();
      expect(ratingReplay).toEqual(ratingAfter);

      // Evidence: one row, the right sub-skill, traceable to this attempt.
      const { data: evidence } = await service.from("evidence").select("skill, metadata, source_url").eq("user_id", userId).eq("source_identifier", `arena-attempt:${attempt.attemptId}`);
      expect(evidence).toHaveLength(1);
      expect((evidence![0].metadata as { skillArea: string; parentSkill: string }).skillArea).toBe(area);
      expect((evidence![0].metadata as { parentSkill: string }).parentSkill).toBe("Data Analysis");

      const cooling = await getWorkstationState(service, userId, "Data Analyst");
      expect(cooling.state).toBe("cooldown");
      await skipCooldown();
    }

    expect([...served].sort()).toEqual([...ENABLED].sort());
    const { data: completions } = await service.from("arena_attempt_completions").select("skill_area_key").eq("user_id", userId);
    expect(completions).toHaveLength(ENABLED.length);

    // Cycle 2 starts without repeating the last area of cycle 1.
    const next = await startNextAttempt(service, userId, "Data Analyst");
    expect(next.state).toBe("active");
    if (next.state === "active") expect(next.attempt.area.key).not.toBe(served[served.length - 1]);
  });
});
