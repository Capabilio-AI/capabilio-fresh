import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { suggestCareersForGoal, type CareerOption } from "@/lib/roadmap/suggest";
import { validateIntent, type IntentState } from "./intent-rules";
import { PLAN_B_CLOSED_MESSAGE, isPlanBOpen } from "./plan-b";
import { isPlanBKind, validatePlanB, type PlanBKind } from "./plan-b-rules";
import { untyped } from "@/lib/org/db";

type Service = SupabaseClient<Database>;
export type Result<T = object> = ({ ok: true } & T) | { ok: false; status: number; message: string };
const fail = (status: number, message: string): { ok: false; status: number; message: string } => ({ ok: false, status, message });

export interface CareerRef {
  id: string;
  key: string;
  name: string;
}
export interface IntentView {
  primary: CareerRef | null;
  secondary: CareerRef | null;
  goalText: string | null;
  /** how sure the interpretation of the goal text was (0–1); not a statement about the student */
  goalConfidence: number | null;
  isExploring: boolean;
  /** how the student answered the one-time Plan B question (3-1); null until they do */
  planBKind: PlanBKind | null;
  lastUpdated: string | null;
}
export interface SuggestionView {
  id: string;
  sourceText: string;
  careers: CareerRef[];
  createdAt: string;
}

/** plan_b_kind (migration 076) is not in the generated types yet. */
const planBKindOf = (row: object | null): PlanBKind | null => {
  const kind = (row as { plan_b_kind?: unknown } | null)?.plan_b_kind;
  return isPlanBKind(kind) ? kind : null;
};

async function activeCareers(service: Service): Promise<(CareerRef & { description: string | null })[]> {
  const { data } = await service.from("careers").select("id, key, name, description").eq("is_active", true).order("name");
  return data ?? [];
}

/** The student's own intent, their pending suggestions, and the careers they can choose from. Always about the caller. */
export async function getCareerIntent(service: Service, userId: string) {
  const [careers, { data: row }, { data: pending }] = await Promise.all([
    activeCareers(service),
    service.from("student_career_intent").select("*").eq("student_id", userId).maybeSingle(),
    service.from("career_suggestions").select("id, source_text, suggested_career_ids, created_at").eq("student_id", userId).eq("status", "PENDING").order("created_at", { ascending: false }),
  ]);
  const ref = new Map(careers.map((c) => [c.id, { id: c.id, key: c.key, name: c.name }]));
  const intent: IntentView = {
    primary: row?.primary_career_id ? ref.get(row.primary_career_id) ?? null : null,
    secondary: row?.secondary_career_id ? ref.get(row.secondary_career_id) ?? null : null,
    goalText: row?.career_goal_text ?? null,
    goalConfidence: row?.career_goal_confidence == null ? null : Number(row.career_goal_confidence),
    isExploring: row?.is_exploring ?? false,
    planBKind: planBKindOf(row),
    lastUpdated: row?.last_updated ?? null,
  };
  const suggestions: SuggestionView[] = (pending ?? []).map((s) => ({
    id: s.id, sourceText: s.source_text, createdAt: s.created_at,
    careers: s.suggested_career_ids.flatMap((id) => (ref.get(id) ? [ref.get(id)!] : [])),
  }));
  return { intent, suggestions, careers: careers.map(({ id, key, name }) => ({ id, key, name })) };
}

async function write(service: Service, userId: string, next: IntentState, extra: { goalText?: string | null; goalConfidence?: number | null } = {}): Promise<Result> {
  const active = new Set((await activeCareers(service)).map((c) => c.id));
  const valid = validateIntent(next, active);
  if (!valid.ok) return fail(400, valid.message);
  const { error } = await service.from("student_career_intent").upsert(
    {
      student_id: userId, primary_career_id: next.primaryCareerId, secondary_career_id: next.secondaryCareerId, is_exploring: next.isExploring, last_updated: new Date().toISOString(),
      ...(extra.goalText !== undefined ? { career_goal_text: extra.goalText } : {}), ...(extra.goalConfidence !== undefined ? { career_goal_confidence: extra.goalConfidence } : {}),
    },
    { onConflict: "student_id" }
  );
  if (error) {
    console.error("[career-intent] write failed:", error.code, error.message);
    return fail(500, "Something went wrong. Please try again.");
  }
  return { ok: true };
}

async function current(service: Service, userId: string): Promise<IntentState> {
  const { data } = await service.from("student_career_intent").select("primary_career_id, secondary_career_id, is_exploring").eq("student_id", userId).maybeSingle();
  return { primaryCareerId: data?.primary_career_id ?? null, secondaryCareerId: data?.secondary_career_id ?? null, isExploring: data?.is_exploring ?? false };
}

/** The student's own explicit choice. A field left out keeps its current value; nothing else can change a career. */
export async function saveCareerIntent(service: Service, userId: string, body: { primaryCareerId?: string | null; secondaryCareerId?: string | null; isExploring?: boolean }): Promise<Result> {
  const now = await current(service, userId);
  const next: IntentState = {
    primaryCareerId: body.primaryCareerId !== undefined ? body.primaryCareerId : now.primaryCareerId,
    // choosing no main career also drops a Plan B (it would be meaningless)
    secondaryCareerId: body.primaryCareerId === null ? null : body.secondaryCareerId !== undefined ? body.secondaryCareerId : now.secondaryCareerId,
    isExploring: body.isExploring !== undefined ? body.isExploring : now.isExploring,
  };
  // Plan B can be added or changed in 3-1 only; clearing it, or leaving it as is, is always allowed.
  if (next.secondaryCareerId && next.secondaryCareerId !== now.secondaryCareerId && !(await isPlanBOpen(service, userId))) return fail(403, PLAN_B_CLOSED_MESSAGE);
  return write(service, userId, next);
}

type Suggest = (goalText: string, careers: CareerOption[]) => Promise<{ key: string; confidence: number }[]>;

/**
 * Interprets the student's own-words goal. Stores it as a PENDING suggestion for them to accept or dismiss and keeps their words; it
 * never touches their chosen careers. Any earlier pending suggestion is superseded (dismissed).
 */
export async function proposeCareers(service: Service, userId: string, goalText: string, suggest: Suggest = suggestCareersForGoal): Promise<Result<{ suggestion: SuggestionView | null }>> {
  const careers = await activeCareers(service);
  let matches: { key: string; confidence: number }[];
  try {
    matches = await suggest(goalText, careers);
  } catch {
    return fail(503, "We couldn't interpret that just now. Try again in a moment, or pick a career yourself.");
  }
  const picked = matches.flatMap((m) => { const c = careers.find((x) => x.key === m.key); return c ? [{ c, confidence: m.confidence }] : []; });
  const now = await current(service, userId);
  const saved = await write(service, userId, now, { goalText, goalConfidence: picked[0]?.confidence ?? null });
  if (!saved.ok) return saved;
  await service.from("career_suggestions").update({ status: "DISMISSED", resolved_at: new Date().toISOString() }).eq("student_id", userId).eq("status", "PENDING");
  if (picked.length === 0) return { ok: true, suggestion: null };
  const { data, error } = await service.from("career_suggestions").insert({ student_id: userId, source_text: goalText, suggested_career_ids: picked.map((p) => p.c.id) }).select("id, created_at").single();
  if (error || !data) return fail(500, "Something went wrong. Please try again.");
  return { ok: true, suggestion: { id: data.id, sourceText: goalText, createdAt: data.created_at, careers: picked.map((p) => ({ id: p.c.id, key: p.c.key, name: p.c.name })) } };
}

/** The student's explicit answer to a suggestion: accept ONE of the suggested careers (as main or Plan B), or dismiss it. */
export async function resolveSuggestion(service: Service, userId: string, suggestionId: string, body: { action: "accept" | "dismiss"; careerId?: string; as?: "primary" | "secondary" }): Promise<Result> {
  const { data: s } = await service.from("career_suggestions").select("id, status, suggested_career_ids").eq("id", suggestionId).eq("student_id", userId).maybeSingle();
  if (!s) return fail(404, "Suggestion not found.");
  if (s.status !== "PENDING") return fail(409, "You've already answered this suggestion.");
  if (body.action === "accept") {
    if (!body.careerId || !s.suggested_career_ids.includes(body.careerId)) return fail(400, "Choose one of the suggested careers.");
    const applied = await saveCareerIntent(service, userId, body.as === "secondary" ? { secondaryCareerId: body.careerId } : { primaryCareerId: body.careerId });
    if (!applied.ok) return applied;
  }
  const { error } = await service.from("career_suggestions").update({ status: body.action === "accept" ? "ACCEPTED" : "DISMISSED", resolved_at: new Date().toISOString() }).eq("id", suggestionId).eq("status", "PENDING");
  return error ? fail(500, "Something went wrong. Please try again.") : { ok: true };
}

/**
 * The one-time Plan B answer, allowed only in 3-1. "change_role" also stores the chosen career as the Plan B career (so its roadmap
 * and baseline check work); every other kind clears it. Asked once: a real choice is final, while "undecided" can still be replaced during 3-1.
 */
export async function savePlanB(service: Service, userId: string, body: { kind: PlanBKind; careerId?: string }): Promise<Result> {
  if (!(await isPlanBOpen(service, userId))) return fail(403, PLAN_B_CLOSED_MESSAGE);
  const { data: row } = await untyped(service).from("student_career_intent").select("primary_career_id, plan_b_kind").eq("student_id", userId).maybeSingle();
  const earlier = planBKindOf(row);
  if (earlier && earlier !== "undecided") return fail(409, "You've already chosen your Plan B.");
  const active = new Set((await activeCareers(service)).map((c) => c.id));
  const valid = validatePlanB(body, (row as { primary_career_id: string | null } | null)?.primary_career_id ?? null, active);
  if (!valid.ok) return fail(400, valid.message);
  const now = new Date().toISOString();
  const { error } = await untyped(service).from("student_career_intent").upsert(
    { student_id: userId, plan_b_kind: body.kind, plan_b_decided_at: now, secondary_career_id: body.kind === "change_role" ? body.careerId : null, last_updated: now },
    { onConflict: "student_id" }
  );
  if (error) {
    console.error("[career-intent] plan b write failed:", error.code, error.message);
    return fail(500, "Something went wrong. Please try again.");
  }
  return { ok: true };
}
