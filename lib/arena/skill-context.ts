import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loadStudentCapabilities, type StudentCapabilities } from "@/lib/capability/read-model";
import { loadSkillIndex, loadSkillNames } from "@/lib/skills/store";
import { resolveSkill, type SkillIndex } from "@/lib/skills/resolve";

export interface PractiseArea {
  areaKey: string;
  areaName: string;
}

/** What Arena and Launchpad both need to talk about skills: the catalog, the user's measured capability, and which skills Arena can build. */
export interface SkillContext {
  capabilities: StudentCapabilities;
  index: SkillIndex;
  names: Map<string, string>;
  /** canonical skill id -> an enabled Arena skill area that builds it */
  practisable: Map<string, PractiseArea>;
  resolve: (text: string) => string | null;
  levelOf: (skillId: string) => number | null;
}

/** Reads only. Everything here comes from the existing capability model and the Arena skill-area table. */
export async function loadSkillContext(service: SupabaseClient<Database>, userId: string): Promise<SkillContext> {
  const [capabilities, index, names, { data: areas }] = await Promise.all([
    loadStudentCapabilities(service, userId),
    loadSkillIndex(service),
    loadSkillNames(service),
    untyped(service).from("arena_skill_areas").select("area_key, display_name, skill_id, sort_order").eq("enabled", true).not("skill_id", "is", null).order("sort_order"),
  ]);
  const practisable = new Map<string, PractiseArea>();
  for (const a of (areas ?? []) as { area_key: string; display_name: string; skill_id: string }[]) if (!practisable.has(a.skill_id)) practisable.set(a.skill_id, { areaKey: a.area_key, areaName: a.display_name });
  return {
    capabilities, index, names, practisable,
    resolve: (text) => resolveSkill(text, index)?.skillId ?? null,
    levelOf: (skillId) => capabilities.bySkill.get(skillId)?.level ?? null,
  };
}
