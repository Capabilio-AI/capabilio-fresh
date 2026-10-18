// One generation run per (scope, week), claimed in arena_weekly_generation so two requests never write the same set twice.
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";

export const RUN_STALE_AFTER_MS = 6 * 60_000;
/** after a run ends short (quota, outage) automatic triggers wait this long before spending AI calls again */
export const RUN_RETRY_COOLDOWN_MS = 15 * 60_000;

export interface RunState { generating: boolean; failedRecently: boolean }

export async function runState(service: SupabaseClient, scopeKey: string, weekStart: string): Promise<RunState> {
  const { data } = await untyped(service).from("arena_weekly_generation").select("status, started_at").eq("scope_key", scopeKey).eq("week_start", weekStart).maybeSingle();
  const age = data ? Date.now() - new Date(data.started_at).getTime() : Infinity;
  return { generating: data?.status === "RUNNING" && age < RUN_STALE_AFTER_MS, failedRecently: data?.status === "FAILED" && age < RUN_RETRY_COOLDOWN_MS };
}

/** True when this caller now owns the run. A stale RUNNING or an old FAILED run is taken over with a compare-and-set on started_at. */
export async function claimRun(service: SupabaseClient, scopeKey: string, weekStart: string, force = false): Promise<boolean> {
  const db = untyped(service);
  const row = { scope_key: scopeKey, week_start: weekStart, status: "RUNNING", started_at: new Date().toISOString() };
  const ins = await db.from("arena_weekly_generation").insert(row);
  if (!ins.error) return true;
  const { data: cur } = await db.from("arena_weekly_generation").select("status, started_at").eq("scope_key", scopeKey).eq("week_start", weekStart).maybeSingle();
  if (!cur) return false;
  const age = Date.now() - new Date(cur.started_at).getTime();
  if (cur.status === "RUNNING" && age < RUN_STALE_AFTER_MS) return false;
  if (cur.status === "FAILED" && !force && age < RUN_RETRY_COOLDOWN_MS) return false;
  const { data: won } = await db.from("arena_weekly_generation").update({ status: "RUNNING", started_at: row.started_at }).eq("scope_key", scopeKey).eq("week_start", weekStart).eq("started_at", cur.started_at).select("week_start");
  return (won?.length ?? 0) > 0;
}

export async function finishRun(service: SupabaseClient, scopeKey: string, weekStart: string, done: boolean, note = ""): Promise<void> {
  await untyped(service).from("arena_weekly_generation").update({ status: done ? "DONE" : "FAILED", note }).eq("scope_key", scopeKey).eq("week_start", weekStart);
}
