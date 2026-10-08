import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { generateCareerRoadmap, type GenerationReport } from "./generate";

type Service = SupabaseClient<Database>;

/** A run that has been RUNNING this long is dead (the function was cut off): it is failed so a new one can start. */
export const STALE_RUN_MS = 8 * 60_000;
/** After a failed run, nobody triggers another for this long, so a broken model call never turns into a cost loop. */
export const COOLDOWN_MS = 10 * 60_000;
export const REFRESH_AFTER_DAYS = 30;

export type RoadmapState = "READY" | "RUNNING" | "FAILED" | "IDLE";

interface RunRow {
  id: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

export async function roadmapState(service: Service, careerId: string, now: Date = new Date()): Promise<{ state: RoadmapState; message: string | null }> {
  const db = untyped(service);
  const [{ data: published }, { data: runs }] = await Promise.all([
    db.from("roadmap_templates").select("id").eq("career_id", careerId).eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(1),
    db.from("roadmap_generation_runs").select("id, status, started_at, finished_at, error").eq("career_id", careerId).order("started_at", { ascending: false }).limit(1),
  ]);
  if (((published ?? []) as unknown[]).length > 0) return { state: "READY", message: null };
  const last = ((runs ?? []) as RunRow[])[0];
  if (last?.status === "RUNNING" && now.getTime() - new Date(last.started_at).getTime() < STALE_RUN_MS) return { state: "RUNNING", message: null };
  if (last?.status === "FAILED") return { state: "FAILED", message: "We couldn't build this roadmap yet. We'll try again shortly." };
  return { state: "IDLE", message: null };
}

export type StartResult = { state: "READY" } | { state: "RUNNING" } | { state: "COOLDOWN"; message: string } | { state: "STARTED"; runId: string };

/** Decides whether to start a generation for a career that has no published roadmap. At most one run per career (the database enforces it). */
export async function requestGeneration(service: Service, careerId: string, opts: { force?: boolean; now?: Date } = {}): Promise<StartResult> {
  const now = opts.now ?? new Date();
  const db = untyped(service);
  if (!opts.force && (await roadmapState(service, careerId, now)).state === "READY") return { state: "READY" };

  // free a run that was cut off
  await db.from("roadmap_generation_runs").update({ status: "FAILED", finished_at: now.toISOString(), error: "The run did not finish in time." }).eq("career_id", careerId).eq("status", "RUNNING").lt("started_at", new Date(now.getTime() - STALE_RUN_MS).toISOString());

  const { data: last } = await db.from("roadmap_generation_runs").select("status, finished_at").eq("career_id", careerId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const lastRun = last as { status: string; finished_at: string | null } | null;
  if (!opts.force && lastRun?.status === "FAILED" && lastRun.finished_at && now.getTime() - new Date(lastRun.finished_at).getTime() < COOLDOWN_MS) {
    return { state: "COOLDOWN", message: "We couldn't build this roadmap yet. We'll try again shortly." };
  }

  const { data, error } = await db.from("roadmap_generation_runs").insert({ career_id: careerId, status: "RUNNING" }).select("id").single();
  if (error) {
    if (error.code === "23505") return { state: "RUNNING" }; // another request just started it
    throw error;
  }
  return { state: "STARTED", runId: (data as { id: string }).id };
}

/** Runs the generation for a started run and records how it ended. Never throws: the outcome is in the run row. */
export async function executeRun(service: Service, runId: string, careerId: string, generate: (s: Service, careerId: string) => Promise<GenerationReport> = generateCareerRoadmap): Promise<void> {
  const db = untyped(service);
  try {
    const report = await generate(service, careerId);
    await db.from("roadmap_generation_runs").update({ status: "SUCCEEDED", finished_at: new Date().toISOString(), template_id: report.templateId, model: report.model, report }).eq("id", runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[roadmap-generate]", careerId, message);
    await db.from("roadmap_generation_runs").update({ status: "FAILED", finished_at: new Date().toISOString(), error: message.slice(0, 1500) }).eq("id", runId);
  }
}

export interface PublishedRoadmap {
  career_id: string;
  source: string;
  published_at: string | null;
}

/**
 * Pure. Which career to build or refresh next: one with no published roadmap first, otherwise the oldest AI-generated one past its refresh date.
 * A roadmap a person authored is never replaced automatically.
 */
export function pickDue(careerIds: string[], published: PublishedRoadmap[], now: Date): { careerId: string; reason: "MISSING" | "STALE" } | null {
  const pub = new Map(published.map((p) => [p.career_id, p]));
  const missing = careerIds.find((id) => !pub.has(id));
  if (missing) return { careerId: missing, reason: "MISSING" };
  const cutoff = now.getTime() - REFRESH_AFTER_DAYS * 86_400_000;
  const stale = published
    .filter((p) => p.source === "AI_GENERATED" && p.published_at && new Date(p.published_at).getTime() < cutoff)
    .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime())[0];
  return stale ? { careerId: stale.career_id, reason: "STALE" } : null;
}

export async function nextCareerDue(service: Service, now: Date = new Date()): Promise<{ careerId: string; reason: "MISSING" | "STALE" } | null> {
  const db = untyped(service);
  const [{ data: careers }, { data: published }] = await Promise.all([
    service.from("careers").select("id").eq("is_active", true),
    db.from("roadmap_templates").select("career_id, source, published_at").eq("status", "PUBLISHED"),
  ]);
  return pickDue((careers ?? []).map((c) => c.id), (published ?? []) as PublishedRoadmap[], now);
}
