import { normalizeSkillText } from "./normalize";

export interface SkillRecord {
  id: string;
  name: string;
  status: string;
}
export interface SkillAliasRecord {
  skillId: string;
  alias: string;
}
export interface SkillIndex {
  /** normalized alias or name -> skill id; ACTIVE skills only */
  exact: Map<string, string>;
}
export interface ResolvedSkill {
  skillId: string;
  via: "alias" | "fuzzy";
  /** 1 for an exact alias match, the similarity ratio for a fuzzy one */
  score: number;
}

/** Fuzzy matching only above this similarity, only for text this long, and only when clearly ahead of the runner-up. */
export const FUZZY_MIN_SCORE = 0.85;
export const FUZZY_MIN_LENGTH = 5;
export const FUZZY_MARGIN = 0.05;

/** Only `active` skills are resolvable: candidates (unreviewed) and deprecated skills never receive new mappings. */
export function buildSkillIndex(skills: SkillRecord[], aliases: SkillAliasRecord[]): SkillIndex {
  const active = new Set(skills.filter((s) => s.status === "active").map((s) => s.id));
  const exact = new Map<string, string>();
  for (const s of skills) if (active.has(s.id)) exact.set(normalizeSkillText(s.name), s.id);
  for (const a of aliases) if (active.has(a.skillId)) exact.set(normalizeSkillText(a.alias), a.skillId);
  exact.delete("");
  return { exact };
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length);

/**
 * Text -> canonical skill, or null (which the caller records as an unresolved suggestion for review).
 * Exact alias/name match first, then a conservative fuzzy match. Never creates a skill; the result is always an id in the index.
 */
export function resolveSkill(text: string, index: SkillIndex): ResolvedSkill | null {
  const q = normalizeSkillText(text);
  if (!q) return null;
  const hit = index.exact.get(q);
  if (hit) return { skillId: hit, via: "alias", score: 1 };
  if (q.length < FUZZY_MIN_LENGTH) return null;

  // best score per skill, so a skill with several aliases does not compete with itself
  const best = new Map<string, number>();
  for (const [key, id] of index.exact) {
    if (Math.abs(key.length - q.length) > Math.ceil(q.length * 0.2)) continue;
    const s = similarity(q, key);
    if (s > (best.get(id) ?? 0)) best.set(id, s);
  }
  const ranked = [...best].sort((a, b) => b[1] - a[1]);
  const [top, runnerUp] = ranked;
  if (!top || top[1] < FUZZY_MIN_SCORE) return null;
  if (runnerUp && top[1] - runnerUp[1] < FUZZY_MARGIN) return null;
  return { skillId: top[0], via: "fuzzy", score: top[1] };
}
