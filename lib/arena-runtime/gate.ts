import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { RUNTIMES } from "./registry";
import type { RuntimeType } from "./types";

export interface RuntimeSetting {
  runtimeType: RuntimeType;
  enabled: boolean;
  maxAttemptsPerDay: number;
  /** 0 = no cost cap (the runtime has no per-attempt cost) */
  dailyCostCapCents: number;
  /** what starting one attempt is recorded as costing (0 for client-side / pure-TS runtimes) */
  attemptCostCents: number;
}

export interface StudentUsageToday {
  attempts: number;
  costCents: number;
}

export type GateDecision = { allowed: true } | { allowed: false; reason: "RUNTIME_NOT_AVAILABLE" | "RUNTIME_DISABLED" | "DAILY_ATTEMPT_LIMIT" | "DAILY_COST_LIMIT" };

/**
 * Pure. May this student start a workstation of this type right now? The kill switch (runtime_settings.enabled) wins over everything;
 * a runtime that is not built yet ("planned") is never startable even if someone flips its switch.
 */
export function evaluateRuntimeGate(setting: RuntimeSetting | undefined, usage: StudentUsageToday): GateDecision {
  if (!setting) return { allowed: false, reason: "RUNTIME_DISABLED" };
  if (RUNTIMES[setting.runtimeType].status !== "available") return { allowed: false, reason: "RUNTIME_NOT_AVAILABLE" };
  if (!setting.enabled) return { allowed: false, reason: "RUNTIME_DISABLED" };
  if (usage.attempts >= setting.maxAttemptsPerDay) return { allowed: false, reason: "DAILY_ATTEMPT_LIMIT" };
  // at the cap nothing more starts; below it, an attempt that would push spend over the cap does not start either
  if (setting.dailyCostCapCents > 0 && (usage.costCents >= setting.dailyCostCapCents || usage.costCents + setting.attemptCostCents > setting.dailyCostCapCents)) return { allowed: false, reason: "DAILY_COST_LIMIT" };
  return { allowed: true };
}

const startOfUtcDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

export async function loadRuntimeSetting(service: SupabaseClient<Database>, runtimeType: RuntimeType): Promise<RuntimeSetting | undefined> {
  const { data, error } = await untyped(service)
    .from("runtime_settings")
    .select("runtime_type, enabled, max_attempts_per_student_per_day, daily_cost_cap_cents_per_student, attempt_cost_cents")
    .eq("runtime_type", runtimeType)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return {
    runtimeType,
    enabled: data.enabled,
    maxAttemptsPerDay: data.max_attempts_per_student_per_day,
    dailyCostCapCents: data.daily_cost_cap_cents_per_student,
    attemptCostCents: Number(data.attempt_cost_cents),
  };
}

export async function loadStudentUsageToday(service: SupabaseClient<Database>, studentId: string, runtimeType: RuntimeType, now = new Date()): Promise<StudentUsageToday> {
  const { data, error } = await untyped(service)
    .from("runtime_usage")
    .select("cost_cents")
    .eq("student_id", studentId)
    .eq("runtime_type", runtimeType)
    .gte("started_at", startOfUtcDay(now));
  if (error) throw error;
  const rows = (data ?? []) as { cost_cents: number | string }[];
  return { attempts: rows.length, costCents: rows.reduce((sum, r) => sum + Number(r.cost_cents), 0) };
}
