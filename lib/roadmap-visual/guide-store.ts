import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { ProjectData, ProjectGuide } from "./project-guide";

type Service = SupabaseClient<Database>;
export interface StoredGuide { guide: ProjectGuide | null; data: ProjectData | null }

/**
 * What was already written for a project. Anything unreadable (an older shape, or the table not existing yet) reads as "not written",
 * so the guide is simply written again instead of failing.
 */
export async function loadStoredGuide(service: Service, resourceId: string): Promise<StoredGuide> {
  try {
    const { data } = await untyped(service).from("project_guides").select("guide, data").eq("resource_id", resourceId).maybeSingle();
    const row = data as { guide: unknown; data: unknown } | null;
    const guide = ProjectGuide.safeParse(row?.guide);
    const dataPart = ProjectData.safeParse(row?.data);
    return { guide: guide.success ? guide.data : null, data: dataPart.success ? dataPart.data : null };
  } catch {
    return { guide: null, data: null };
  }
}

/** Keeps what was written. Storing is best effort: a failure costs a rewrite next time, never the student's guide. */
export async function saveGuide(service: Service, resourceId: string, parts: { guide?: ProjectGuide; data?: ProjectData }): Promise<void> {
  if (!parts.guide && !parts.data) return;
  try {
    const { error } = await untyped(service).from("project_guides").upsert({ resource_id: resourceId, ...parts, updated_at: new Date().toISOString() }, { onConflict: "resource_id" });
    if (error) console.warn("[project-guide] could not store the guide:", error.message);
  } catch (e) {
    console.warn("[project-guide] could not store the guide:", e instanceof Error ? e.message : e);
  }
}
