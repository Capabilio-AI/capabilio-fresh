import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loggedCompleteJson } from "@/lib/ai/log";
import type { Resource } from "./graph-types";
import { DATA_SYSTEM, GUIDE_SYSTEM, ProjectData, ProjectGuide, buildDataPrompt, buildGuidePrompt } from "./project-guide";
import { readGuideState, saveGuide } from "./guide-store";

type Service = SupabaseClient<Database>;

/**
 * Writes whatever is missing for a project (the guide, and its practice data) and stores it. The guide is career-neutral on purpose: it is
 * shared by every student who opens the project. The data is optional: if it cannot be written the guide is still kept and the data is tried
 * again later. Throws only when there is still no guide. Used by the route (in the background), the hourly top-up and the backfill script.
 */
export async function writeProjectGuide(service: Service, resource: Resource, userId: string | null): Promise<{ guide: boolean; data: boolean }> {
  const have = await readGuideState(service, resource.id);
  const call = <T,>(feature: string, prompt: string, system: string, schema: ZodType<T>) => loggedCompleteJson(service, { feature, userId, meta: { resource: resource.id } }, prompt, system, schema);
  const [guide, data] = await Promise.allSettled([
    have.guide ? Promise.resolve(have.guide) : call("roadmap_project_guide", buildGuidePrompt(resource, ""), GUIDE_SYSTEM, ProjectGuide),
    have.data ? Promise.resolve(have.data) : call("roadmap_project_data", buildDataPrompt(resource, ""), DATA_SYSTEM, ProjectData),
  ]);
  const guideValue = guide.status === "fulfilled" ? guide.value : null;
  const dataValue = data.status === "fulfilled" ? data.value : null;
  if (!guideValue) {
    const message = guide.status === "rejected" && guide.reason instanceof Error ? guide.reason.message : "The guide could not be written.";
    await saveGuide(service, resource.id, { error: message });
    throw new Error(message);
  }
  if (!dataValue) console.warn("[project-guide] practice data not written:", data.status === "rejected" && data.reason instanceof Error ? data.reason.message : "unknown");
  await saveGuide(service, resource.id, { guide: guideValue, ...(dataValue ? { data: dataValue } : {}) });
  return { guide: true, data: Boolean(dataValue) };
}

/** A catalogue project as a Resource, from its own rows (no student, no roadmap). */
export async function loadProjectResource(service: Service, id: string): Promise<Resource | null> {
  const db = untyped(service);
  const { data } = await db.from("project_catalog").select("id, title, description, difficulty, expected_evidence").eq("id", id).maybeSingle();
  const p = data as { id: string; title: string; description: string; difficulty: string; expected_evidence: string[] | null } | null;
  if (!p) return null;
  const { data: links } = await db.from("project_skills").select("skill_id").eq("project_id", id);
  const skillIds = ((links ?? []) as { skill_id: string }[]).map((l) => l.skill_id);
  const { data: skills } = skillIds.length ? await service.from("skills").select("name").in("id", skillIds) : { data: [] };
  return { id: p.id, kind: "PROJECT", title: p.title, provider: null, url: "/arena/projects", type: null, tier: "FREE", difficulty: p.difficulty, hours: null, cost: null, note: p.description.slice(0, 160), description: p.description, evidence: p.expected_evidence ?? [], skills: (skills ?? []).map((s) => s.name) };
}

/** Ids of active catalogue projects that still lack a guide or its data, oldest first. */
export async function projectsMissingGuides(service: Service, limit: number): Promise<string[]> {
  const db = untyped(service);
  const [{ data: projects }, { data: done }] = await Promise.all([
    db.from("project_catalog").select("id").eq("status", "ACTIVE").order("created_at"),
    db.from("project_guides").select("resource_id, guide, data"),
  ]);
  const complete = new Set(((done ?? []) as { resource_id: string; guide: unknown; data: unknown }[]).filter((r) => r.guide && r.data).map((r) => r.resource_id));
  return ((projects ?? []) as { id: string }[]).map((p) => p.id).filter((id) => !complete.has(id)).slice(0, limit);
}
