import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { ProjectData, ProjectGuide } from "./project-guide";

type Service = SupabaseClient<Database>;
export interface StoredGuide { guide: ProjectGuide | null; data: ProjectData | null }
export interface GuideState extends StoredGuide {
  /** someone is writing it right now (and started less than WRITER_STALE_MS ago) */
  writing: boolean;
  /** the last attempt failed, and how long ago */
  failure: { message: string; ageMs: number } | null;
}

/** A writer that has not finished after this long is treated as gone, so a crashed run never blocks a project for good. */
export const WRITER_STALE_MS = 5 * 60_000;

/**
 * What was already written for a project, and whether someone is writing it. Anything unreadable (an older shape, or the table or columns not
 * existing yet) reads as "not written", so the guide is simply written again instead of failing.
 */
export async function readGuideState(service: Service, resourceId: string): Promise<GuideState> {
  const empty: GuideState = { guide: null, data: null, writing: false, failure: null };
  try {
    const { data } = await untyped(service).from("project_guides").select("guide, data, generating_since, last_error, updated_at").eq("resource_id", resourceId).maybeSingle();
    const row = data as { guide: unknown; data: unknown; generating_since: string | null; last_error: string | null; updated_at: string } | null;
    if (!row) return empty;
    const guide = ProjectGuide.safeParse(row.guide);
    const dataPart = ProjectData.safeParse(row.data);
    const writing = Boolean(row.generating_since) && Date.now() - Date.parse(row.generating_since as string) < WRITER_STALE_MS;
    return {
      guide: guide.success ? guide.data : null,
      data: dataPart.success ? dataPart.data : null,
      writing,
      failure: row.last_error ? { message: row.last_error, ageMs: Date.now() - Date.parse(row.updated_at) } : null,
    };
  } catch {
    return empty;
  }
}

export const loadStoredGuide = async (service: Service, resourceId: string): Promise<StoredGuide> => {
  const { guide, data } = await readGuideState(service, resourceId);
  return { guide, data };
};

/**
 * Takes the writer slot for a project. "claimed" means this caller should write it; "busy" means someone else is already writing it.
 * "unavailable" (the table or columns are missing) tells the caller to write inline instead.
 */
export async function claimWriter(service: Service, resourceId: string): Promise<"claimed" | "busy" | "unavailable"> {
  try {
    const db = untyped(service);
    const now = new Date();
    const stale = new Date(now.getTime() - WRITER_STALE_MS).toISOString();
    const made = await db.from("project_guides").upsert({ resource_id: resourceId }, { onConflict: "resource_id", ignoreDuplicates: true });
    if (made.error) return "unavailable";
    const { data, error } = await db.from("project_guides").update({ generating_since: now.toISOString(), last_error: null }).eq("resource_id", resourceId).or(`generating_since.is.null,generating_since.lt.${stale}`).select("resource_id");
    if (error) return "unavailable";
    return (data ?? []).length > 0 ? "claimed" : "busy";
  } catch {
    return "unavailable";
  }
}

/** Keeps what was written and releases the writer slot. Storing is best effort: a failure costs a rewrite next time, never the student's guide. */
export async function saveGuide(service: Service, resourceId: string, parts: { guide?: ProjectGuide; data?: ProjectData; error?: string | null }): Promise<void> {
  try {
    const row: Record<string, unknown> = { resource_id: resourceId, generating_since: null, updated_at: new Date().toISOString() };
    if (parts.guide) row.guide = parts.guide;
    if (parts.data) row.data = parts.data;
    if (parts.error !== undefined) row.last_error = parts.error ? parts.error.slice(0, 300) : null;
    else if (parts.guide) row.last_error = null;
    const { error } = await untyped(service).from("project_guides").upsert(row, { onConflict: "resource_id" });
    if (error) console.warn("[project-guide] could not store the guide:", error.message);
  } catch (e) {
    console.warn("[project-guide] could not store the guide:", e instanceof Error ? e.message : e);
  }
}
