import type { MappingView, SkillOption } from "./admin-data";

/** Pure view helpers for the skill picker and mapping lists. No React, no I/O. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();

/** The catalog grouped by category (alphabetical), filtered by a free-text query over name, key, description and category. */
export function groupCatalog(skills: SkillOption[], query: string, exclude: ReadonlySet<string> = new Set()): { category: string; skills: SkillOption[] }[] {
  const q = squash(query);
  const groups = new Map<string, SkillOption[]>();
  for (const s of skills) {
    if (exclude.has(s.key) || exclude.has(s.id)) continue;
    if (q && !squash(`${s.name} ${s.key} ${s.description ?? ""} ${s.category}`).includes(q)) continue;
    groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => ({ category, skills: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

const ORDER = { CONFIRMED: 0, SUGGESTED: 1, REJECTED: 2 } as const;

/** Every stored mapping, once, in a stable order: confirmed, then suggested (highest confidence first), then rejected. */
export function mappingChips(mappings: MappingView[]): MappingView[] {
  return [...mappings].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.confidence ?? 0) - (a.confidence ?? 0) || a.skillName.localeCompare(b.skillName));
}

/** Counts derived from the SAME rows the chips are drawn from, so a label can never disagree with what is on screen. */
export function statusCounts(mappings: MappingView[]): { confirmed: number; suggested: number; rejected: number; total: number } {
  const c = { confirmed: 0, suggested: 0, rejected: 0 };
  for (const m of mappings) c[m.status === "CONFIRMED" ? "confirmed" : m.status === "SUGGESTED" ? "suggested" : "rejected"]++;
  return { ...c, total: mappings.length };
}

export function reviewState(mappings: MappingView[]): "none" | "needs_review" | "reviewed" {
  if (mappings.length === 0) return "none";
  return mappings.some((m) => m.status === "SUGGESTED") ? "needs_review" : "reviewed";
}
