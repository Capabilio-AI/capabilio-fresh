import { experienceMonths, type ExperienceRow } from "./experience";

export const LEVELS = ["learning", "working", "expert"] as const;
export type SkillLevel = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<SkillLevel, string> = { learning: "Learning", working: "Working knowledge", expert: "Expert" };

export const CATEGORIES = ["Engineering", "Data", "Cloud and DevOps", "Product and design", "Leadership", "Domain", "Tools", "Other"] as const;

export interface ProSkill { id: string; name: string; category: string; level: SkillLevel; source: "resume" | "added"; jobIds: string[] }
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export interface SkillValue { name: string; category: string; level: SkillLevel; jobIds: string[] }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A skill a professional adds or edits: a name, a category, a level and the jobs it was used in. */
export function validateSkill(input: unknown): Checked<SkillValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = typeof i.name === "string" ? i.name.replace(/\s+/g, " ").trim() : "";
  if (!name || name.length > 60) return { ok: false, error: "Give the skill a name (up to 60 characters)." };
  const category = typeof i.category === "string" && i.category.trim() ? i.category.replace(/\s+/g, " ").trim() : categoryFor(name);
  if (category.length > 40) return { ok: false, error: "Keep the category under 40 characters." };
  const level = i.level;
  if (typeof level !== "string" || !(LEVELS as readonly string[]).includes(level)) return { ok: false, error: "Choose a level." };
  const rawJobs = Array.isArray(i.jobIds) ? i.jobIds : [];
  if (rawJobs.length > 20 || rawJobs.some((j) => typeof j !== "string" || !UUID.test(j))) return { ok: false, error: "Those jobs are not valid." };
  return { ok: true, value: { name, category, level: level as SkillLevel, jobIds: [...new Set(rawJobs as string[])] } };
}

/** Months of experience behind a skill: the time in the jobs it is linked to, overlap counted once. */
export function monthsFor(skill: Pick<ProSkill, "jobIds">, jobs: readonly (ExperienceRow & { id: string })[], now: Date = new Date()): number {
  return experienceMonths(jobs.filter((j) => skill.jobIds.includes(j.id)), now);
}

export type Size = "small" | "medium" | "large";
export const sizeOf = (months: number): Size => (months >= 36 ? "large" : months >= 12 ? "medium" : "small");

export interface Group { category: string; skills: ProSkill[] }

/** Skills grouped by category in a steady order: the listed categories first, then any custom ones, each group A to Z. */
export function groupSkills(skills: readonly ProSkill[]): Group[] {
  const by = new Map<string, ProSkill[]>();
  for (const s of skills) by.set(s.category, [...(by.get(s.category) ?? []), s]);
  const order = (c: string) => { const i = (CATEGORIES as readonly string[]).indexOf(c); return i === -1 ? CATEGORIES.length : i; };
  return [...by].map(([category, list]) => ({ category, skills: [...list].sort((a, b) => a.name.localeCompare(b.name)) })).sort((a, b) => order(a.category) - order(b.category) || a.category.localeCompare(b.category));
}

const AREAS: [string, RegExp][] = [
  ["Data", /\b(sql|mysql|postgres|nosql|mongodb|data|analytics?|analysis|statistic\w*|tableau|power ?bi|looker|excel|vba|python|pandas|numpy|spark|hadoop|etl|dashboard\w*|machine learning|ml|ai|bi)\b/i],
  ["Cloud and DevOps", /\b(aws|azure|gcp|cloud|docker|kubernetes|k8s|terraform|ci\/?cd|jenkins|devops|linux|ansible|git|github|gitlab)\b/i],
  ["Engineering", /\b(java|javascript|typescript|react|node\.?js?|angular|vue|c\+\+|c#|go|golang|rust|php|ruby|swift|kotlin|api|rest|graphql|microservices|backend|frontend|full ?stack|html|css|testing|qa|selenium)\b/i],
  ["Product and design", /\b(product|roadmap|figma|ux|ui|design|user research|agile|scrum|jira|requirements|stakeholder\w*)\b/i],
  ["Leadership", /\b(leadership|management|managing|mentoring|coaching|hiring|team|communication|presentation|negotiation|strategy|planning|change control|governance|budget\w*|project management)\b/i],
];

/** A sensible area for a skill from its name, so a resume's skills are grouped without anyone sorting them. "Other" when nothing fits. */
export function categoryFor(name: string): string {
  for (const [area, re] of AREAS) if (re.test(name)) return area;
  return "Other";
}
