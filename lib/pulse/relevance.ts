/** Pure scoring for the Pulse feed: how relevant a post is to someone's career goal, and how it ranks. */
export interface CareerContext {
  /** the person's goals, primary first, as written ("AI/ML Engineer") */
  roles: string[];
  /** role words (weight 1) and skill phrases (weight 0.6) */
  keywords: { term: string; weight: number }[];
}
export const EMPTY_CONTEXT: CareerContext = { roles: [], keywords: [] };

const GENERIC = new Set(["engineer", "developer", "analyst", "manager", "specialist", "intern", "senior", "junior", "lead", "of", "and", "the", "for", "in", "a", "an", "to"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);

/** Keywords from career names and the skills they require. Generic job-title words alone never count. */
export function buildKeywords(roleNames: readonly string[], skillNames: readonly string[]): CareerContext["keywords"] {
  const out = new Map<string, number>();
  for (const role of roleNames) for (const w of words(role)) if (w.length >= 2 && !GENERIC.has(w)) out.set(w, 1);
  for (const skill of skillNames) {
    const phrase = words(skill).join(" ");
    if (phrase.length >= 2 && !GENERIC.has(phrase) && !out.has(phrase)) out.set(phrase, 0.6);
  }
  return [...out].map(([term, weight]) => ({ term, weight }));
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 0..1: how much of the person's career vocabulary the text uses. Two solid matches is already "relevant". */
export function relevance(text: string, keywords: CareerContext["keywords"]): number {
  if (keywords.length === 0) return 0;
  const hay = ` ${words(text).join(" ")} `;
  let total = 0;
  for (const k of keywords) if (new RegExp(`(^|\\s)${escapeRegex(k.term)}(\\s|$)`).test(hay)) total += k.weight;
  return Math.min(1, total / 2);
}

export const engagementOf = (likes: number, comments: number): number => likes + 2 * comments;

export interface ScoreInput {
  ageHours: number;
  engagement: number;
  relevance: number;
  followed: boolean;
  /** a college or organisation page post */
  page: boolean;
  ownCollege: boolean;
}

const HALF_LIFE_HOURS = 36;

/** Recency, engagement, relationship and career fit, in one number. */
export function scoreItem(i: ScoreInput): number {
  const recency = 100 * Math.pow(0.5, Math.max(0, i.ageHours) / HALF_LIFE_HOURS);
  return recency + 14 * Math.log1p(i.engagement) + (i.followed ? 40 : 0) + 38 * i.relevance + (i.page ? 18 : 0) + (i.ownCollege ? 12 : 0);
}

/** This week's trending: engagement dominates, career fit lifts, age only breaks ties. */
export function trendingScore(i: ScoreInput): number {
  return 30 * Math.log1p(i.engagement) + 45 * i.relevance + (i.followed ? 10 : 0) + 20 * Math.pow(0.5, Math.max(0, i.ageHours) / 72);
}

export function reasonFor(i: { page: boolean; orgName?: string; followed: boolean; engagement: number; relevance: number; role: string | null; trending: boolean }): string | null {
  if (i.page && i.orgName) return `From ${i.orgName}`;
  if (i.followed) return "From someone you follow";
  if (i.trending || i.engagement >= 4) return i.relevance >= 0.34 && i.role ? `Trending for ${i.role}` : "Trending this week";
  if (i.relevance >= 0.34 && i.role) return `For ${i.role}`;
  return null;
}
