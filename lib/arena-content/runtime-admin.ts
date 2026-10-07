import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { RUNTIMES } from "@/lib/arena-runtime/registry";
import { RUNTIME_TYPES, type RuntimeType } from "@/lib/arena-runtime/types";

type Service = SupabaseClient<Database>;

export const RuntimeSettingsPatch = z
  .object({
    runtimeType: z.enum(RUNTIME_TYPES),
    enabled: z.boolean().optional(),
    maxAttemptsPerStudentPerDay: z.number().int().min(0).max(1000).optional(),
    dailyCostCapCentsPerStudent: z.number().int().min(0).max(100_000).optional(),
    attemptCostCents: z.number().min(0).max(10_000).optional(),
  })
  .strict();

export interface RuntimeAdminRow {
  runtimeType: RuntimeType;
  label: string;
  available: boolean;
  enabled: boolean;
  maxAttemptsPerStudentPerDay: number;
  dailyCostCapCentsPerStudent: number;
  attemptCostCents: number;
  /** usage in the last 24h across all students */
  attemptsToday: number;
  costTodayCents: number;
  students24h: number;
}

/** Every runtime's switch, caps and the last 24h of usage: the feature-flag and cost view for admins. */
export async function loadRuntimeAdmin(service: Service, now: Date = new Date()): Promise<RuntimeAdminRow[]> {
  const db = untyped(service);
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: settings }, { data: usage }] = await Promise.all([
    db.from("runtime_settings").select("runtime_type, enabled, max_attempts_per_student_per_day, daily_cost_cap_cents_per_student, attempt_cost_cents"),
    db.from("runtime_usage").select("runtime_type, student_id, cost_cents").gte("started_at", since),
  ]);
  const used = (usage ?? []) as { runtime_type: RuntimeType; student_id: string; cost_cents: number | string }[];
  const byType = new Map((settings ?? []).map((s: { runtime_type: RuntimeType }) => [s.runtime_type, s]));
  return RUNTIME_TYPES.map((type): RuntimeAdminRow => {
    const s = byType.get(type) as { enabled: boolean; max_attempts_per_student_per_day: number; daily_cost_cap_cents_per_student: number; attempt_cost_cents: number | string } | undefined;
    const rows = used.filter((u) => u.runtime_type === type);
    return {
      runtimeType: type,
      label: RUNTIMES[type].label,
      available: RUNTIMES[type].status === "available",
      enabled: s?.enabled ?? false,
      maxAttemptsPerStudentPerDay: s?.max_attempts_per_student_per_day ?? 20,
      dailyCostCapCentsPerStudent: s?.daily_cost_cap_cents_per_student ?? 0,
      attemptCostCents: Number(s?.attempt_cost_cents ?? 0),
      attemptsToday: rows.length,
      costTodayCents: rows.reduce((n, r) => n + Number(r.cost_cents), 0),
      students24h: new Set(rows.map((r) => r.student_id)).size,
    };
  });
}

/** Changes take effect on the next attempt start: no deploy. A runtime that is not built cannot be enabled. */
export async function updateRuntimeSettings(service: Service, patch: z.infer<typeof RuntimeSettingsPatch>, adminId: string): Promise<void> {
  if (patch.enabled && RUNTIMES[patch.runtimeType].status !== "available") throw Object.assign(new Error(`${RUNTIMES[patch.runtimeType].label} is not built yet and cannot be enabled.`), { status: 409 });
  const update: Record<string, unknown> = { updated_by: adminId, updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.maxAttemptsPerStudentPerDay !== undefined) update.max_attempts_per_student_per_day = patch.maxAttemptsPerStudentPerDay;
  if (patch.dailyCostCapCentsPerStudent !== undefined) update.daily_cost_cap_cents_per_student = patch.dailyCostCapCentsPerStudent;
  if (patch.attemptCostCents !== undefined) update.attempt_cost_cents = patch.attemptCostCents;
  const { error } = await untyped(service).from("runtime_settings").update(update).eq("runtime_type", patch.runtimeType);
  if (error) throw error;
}
