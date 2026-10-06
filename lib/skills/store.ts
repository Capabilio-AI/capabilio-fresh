import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { normalizeSkillText } from "./normalize";
import { buildSkillIndex, resolveSkill, type ResolvedSkill, type SkillIndex } from "./resolve";

type Service = SupabaseClient<Database>;
export type SuggestionSource = Database["public"]["Tables"]["skill_suggestions"]["Row"]["source"];

/** Loads the taxonomy once; resolve many strings against it with `resolveSkill`. Service-role or any client (both tables are world-readable). */
export async function loadSkillIndex(client: Service): Promise<SkillIndex> {
  const [{ data: skills, error: e1 }, { data: aliases, error: e2 }] = await Promise.all([
    client.from("skills").select("id, name, status").eq("status", "active"),
    client.from("skill_aliases").select("skill_id, alias"),
  ]);
  if (e1 || e2) throw new Error("Could not load the skill taxonomy.");
  return buildSkillIndex(skills ?? [], (aliases ?? []).map((a) => ({ skillId: a.skill_id, alias: a.alias })));
}

/**
 * Text that did not resolve goes to the review queue — it is NEVER turned into a skill automatically.
 * Service role only (the table is private). ponytail: read-then-write, so concurrent hits can undercount `occurrences`; it is advisory.
 */
export async function recordUnresolved(service: Service, text: string, source: SuggestionSource): Promise<void> {
  const normalized = normalizeSkillText(text).slice(0, 200);
  if (!normalized) return;
  const { data: existing } = await service.from("skill_suggestions").select("occurrences").eq("normalized_text", normalized).maybeSingle();
  const { error } = existing
    ? await service.from("skill_suggestions").update({ occurrences: existing.occurrences + 1, last_seen_at: new Date().toISOString() }).eq("normalized_text", normalized)
    : await service.from("skill_suggestions").insert({ normalized_text: normalized, display_text: text.trim().slice(0, 200), source });
  if (error) throw new Error("Could not record the unresolved skill.");
}

/** Resolve a batch; unresolved texts are queued and returned so the caller can show them as "new skill suggestions". */
export async function resolveSkills(service: Service, texts: string[], source: SuggestionSource): Promise<{ resolved: Map<string, ResolvedSkill>; unresolved: string[] }> {
  const index = await loadSkillIndex(service);
  const resolved = new Map<string, ResolvedSkill>();
  const unresolved: string[] = [];
  for (const text of new Set(texts)) {
    const hit = resolveSkill(text, index);
    if (hit) resolved.set(text, hit);
    else {
      unresolved.push(text);
      await recordUnresolved(service, text, source);
    }
  }
  return { resolved, unresolved };
}
