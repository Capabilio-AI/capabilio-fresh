import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { normalizeSkillText } from "@/lib/skills/normalize";

export const ChildSkillSpec = z.object({
  key: z.string().regex(/^SKILL_[A-Z0-9_]{2,80}$/),
  name: z.string().min(2).max(100),
  /** the EXISTING skill this one refines, by name */
  parent: z.string().min(1),
  description: z.string().min(20).max(300),
});
export const ChildSkillsFile = z.object({ purpose: z.string().optional(), skills: z.array(ChildSkillSpec).min(1) });
export type ChildSkillSpec = z.infer<typeof ChildSkillSpec>;

export interface ExistingSkill {
  key: string | null;
  name: string;
  status: "active" | "candidate" | "deprecated";
  category: string | null;
}

/**
 * Pure. Checks a child-skills spec against the taxonomy as it stands: the parent must be an existing ACTIVE skill; a new skill must not reuse an
 * existing name, key or alias (which would shadow or confuse the resolver); names and keys are unique within the file.
 */
export function validateChildSkills(spec: ChildSkillSpec[], existing: ExistingSkill[], aliases: ReadonlySet<string>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const active = new Map(existing.filter((s) => s.status === "active").map((s) => [s.name, s]));
  const byKey = new Map(existing.filter((s) => s.key).map((s) => [s.key as string, s]));
  const byNormalizedName = new Map(existing.map((s) => [normalizeSkillText(s.name), s]));
  const seenKeys = new Set<string>();
  const seenNames = new Set<string>();

  for (const s of spec) {
    const normalized = normalizeSkillText(s.name);
    if (seenKeys.has(s.key)) errors.push(`Duplicate key ${s.key} in the file.`);
    if (seenNames.has(normalized)) errors.push(`Duplicate name "${s.name}" in the file.`);
    seenKeys.add(s.key);
    seenNames.add(normalized);

    const parent = active.get(s.parent);
    if (!parent) errors.push(`${s.key}: parent "${s.parent}" is not an existing active skill.`);
    else if (!parent.category) errors.push(`${s.key}: parent "${s.parent}" has no category to inherit.`);

    const sameKey = byKey.get(s.key);
    if (sameKey && sameKey.name !== s.name) errors.push(`${s.key}: the key is already used by "${sameKey.name}".`);
    const sameName = byNormalizedName.get(normalized);
    if (sameName && sameName.key !== s.key) errors.push(`${s.key}: the name "${s.name}" is too close to the existing skill "${sameName.name}".`);
    if (aliases.has(normalized)) errors.push(`${s.key}: "${s.name}" is already an alias of another skill, so the resolver would send it there.`);
    if (/\b(and|or)\b.*\b(and|or)\b/i.test(s.name)) warnings.push(`${s.key}: "${s.name}" reads like several skills; consider splitting it.`);
  }
  return { errors, warnings };
}

type Service = SupabaseClient<Database>;

export async function loadTaxonomy(service: Service): Promise<{ existing: ExistingSkill[]; aliases: Set<string> }> {
  const [{ data: skills }, { data: aliases }] = await Promise.all([service.from("skills").select("key, name, status, category"), service.from("skill_aliases").select("alias")]);
  return { existing: (skills ?? []) as ExistingSkill[], aliases: new Set((aliases ?? []).map((a) => a.alias)) };
}

/** Writes new skills as CANDIDATES (never active): they cannot be used by a career or a roadmap node until a reviewer activates them. Idempotent by key. */
export async function importChildSkillsAsCandidates(service: Service, spec: ChildSkillSpec[]): Promise<{ created: number; skipped: number }> {
  const db = untyped(service);
  const { data: all } = await service.from("skills").select("id, key, name, category");
  const byName = new Map((all ?? []).map((s) => [s.name, s]));
  const existingKeys = new Set((all ?? []).map((s) => s.key).filter(Boolean));
  const rows = spec
    .filter((s) => !existingKeys.has(s.key))
    .map((s) => {
      const parent = byName.get(s.parent);
      return { key: s.key, name: s.name, category: parent?.category ?? null, parent_skill_id: parent?.id ?? null, description: s.description, status: "candidate" };
    });
  if (rows.length) {
    const { error } = await db.from("skills").insert(rows);
    if (error) throw error;
  }
  return { created: rows.length, skipped: spec.length - rows.length };
}

/** Reviewer action: make the named candidate skills active. Only candidates created from this spec can be activated this way. */
export async function activateSkills(service: Service, keys: string[]): Promise<number> {
  const { data, error } = await untyped(service).from("skills").update({ status: "active" }).in("key", keys).eq("status", "candidate").select("key");
  if (error) throw error;
  return (data ?? []).length;
}
