import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { cryptoRandomIndex, reconcileRotation, type RandomIndex, type RotationSnapshot } from "./rotation";
import { logArenaEvent } from "./log";

export interface Reservation {
  areaKey: string;
  version: number;
  cycleNumber: number;
}

const MAX_RESERVE_TRIES = 4;

/**
 * Picks the area the next attempt will use WITHOUT consuming it. Persists a
 * reconciled bag (new cycle / taxonomy change) with a version-checked update,
 * so two concurrent requests can't both write a different shuffle — the loser
 * re-reads and uses the winner's bag.
 */
export async function reserveNextArea(
  service: SupabaseClient<Database>,
  userId: string,
  roleKey: string,
  activeAreaKeys: string[],
  randomIndex: RandomIndex = cryptoRandomIndex
): Promise<Reservation> {
  const { error: seedError } = await service.from("arena_rotation_state").upsert({ user_id: userId, role_key: roleKey }, { onConflict: "user_id,role_key", ignoreDuplicates: true });
  if (seedError) throw seedError;

  for (let attempt = 0; attempt < MAX_RESERVE_TRIES; attempt++) {
    const { data: row, error } = await service.from("arena_rotation_state").select("*").eq("user_id", userId).eq("role_key", roleKey).single();
    if (error || !row) throw error ?? new Error("Rotation state missing");

    const current: RotationSnapshot = { cycleNumber: row.cycle_number, remaining: row.remaining, served: row.served, lastServed: row.last_served };
    const { next, changed } = reconcileRotation(current, activeAreaKeys, randomIndex);
    if (!changed) return { areaKey: next.remaining[0], version: row.version, cycleNumber: next.cycleNumber };

    const { data: updated, error: updateError } = await service
      .from("arena_rotation_state")
      .update({ cycle_number: next.cycleNumber, remaining: next.remaining, served: next.served, version: row.version + 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("role_key", roleKey)
      .eq("version", row.version)
      .select("version");
    if (updateError) throw updateError;
    if (updated && updated.length === 1) {
      if (next.cycleNumber !== current.cycleNumber) logArenaEvent("rotation.cycle_started", { userId, roleKey, cycle: next.cycleNumber, size: next.remaining.length });
      return { areaKey: next.remaining[0], version: row.version + 1, cycleNumber: next.cycleNumber };
    }
    // Another request changed the state first — re-read and reconcile again.
  }
  throw new Error("Could not reserve a rotation slot after concurrent updates.");
}

export interface ChallengeInstanceInput {
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  scenario: string;
  objective: string;
  requester: string;
  skill_tags: string[];
  tool_type: string;
  content: Json;
  answer_key: Json;
  generation_provider: string;
  generation_model: string;
  generation_version: string;
  grading_version: string;
}

/**
 * Atomically: re-check the reservation, persist the immutable instance,
 * create the attempt, pop the area off the bag. `conflict` means another
 * request already advanced this rotation (or an attempt is open) and nothing
 * was written.
 */
export async function commitReservedAttempt(
  service: SupabaseClient<Database>,
  userId: string,
  roleKey: string,
  reservation: Reservation,
  challenge: ChallengeInstanceInput
): Promise<{ conflict: true } | { conflict: false; attemptId: string; challengeId: string }> {
  const { data, error } = await service.rpc("commit_rotation_attempt", {
    p_user_id: userId,
    p_role_key: roleKey,
    p_area_key: reservation.areaKey,
    p_expected_version: reservation.version,
    p_challenge: challenge as unknown as Json,
  });
  if (error) throw error;
  const result = data as { conflict: boolean; attempt_id?: string; challenge_id?: string };
  if (result.conflict) return { conflict: true };
  logArenaEvent("rotation.slot_served", { userId, roleKey, area: reservation.areaKey, cycle: reservation.cycleNumber, attemptId: result.attempt_id });
  return { conflict: false, attemptId: result.attempt_id!, challengeId: result.challenge_id! };
}
