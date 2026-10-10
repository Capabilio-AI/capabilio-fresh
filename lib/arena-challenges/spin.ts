import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { currentStreamWeek } from "./week";
import { WHEEL_COUNTS, pickIndex } from "./wheel";

export interface SpinState {
  weekStart: string;
  /** null until the student has spun this week */
  spin: { count: number; revealed: boolean } | null;
}

type Row = { challenge_count: number; revealed_at: string | null };
const toSpin = (r: Row | null) => (r ? { count: r.challenge_count, revealed: r.revealed_at !== null } : null);

export async function getSpin(service: SupabaseClient, userId: string): Promise<SpinState> {
  const weekStart = currentStreamWeek();
  const { data } = await untyped(service).from("arena_stream_spins").select("challenge_count, revealed_at").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
  return { weekStart, spin: toSpin(data as Row | null) };
}

/** One spin per student per week. The number is drawn here and stored first; a second call (or a second tab) just returns it. */
export async function spinWheel(service: SupabaseClient, userId: string): Promise<SpinState> {
  const weekStart = currentStreamWeek();
  const count = WHEEL_COUNTS[pickIndex((n) => randomInt(n))];
  // ignoreDuplicates: if this week's row exists the insert is a no-op and the stored number below wins
  await untyped(service).from("arena_stream_spins").upsert({ user_id: userId, week_start: weekStart, challenge_count: count }, { onConflict: "user_id,week_start", ignoreDuplicates: true });
  return getSpin(service, userId);
}

/** Called when the scratch card is revealed; only then do the week's challenges open. Idempotent. */
export async function revealSpin(service: SupabaseClient, userId: string): Promise<SpinState> {
  const weekStart = currentStreamWeek();
  await untyped(service).from("arena_stream_spins").update({ revealed_at: new Date().toISOString() }).eq("user_id", userId).eq("week_start", weekStart).is("revealed_at", null);
  return getSpin(service, userId);
}
