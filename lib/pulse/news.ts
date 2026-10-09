// Technical news for the student's own career, live from the Hacker News search API (free, no key). Each skill phrase of the role is searched
// for stories from the last two weeks with real engagement; results are merged, de-duplicated and cached for half an hour.
import type { CareerContext } from "./relevance";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  points: number;
  comments: number;
  at: string;
}

const DAYS = 14;
const MIN_POINTS = 30;
const PHRASES = 3;
const PER_QUERY = 8;
export const NEWS_COUNT = 5;
const TIMEOUT_MS = 4000;
const CACHE_SECONDS = 1800;

interface Hit { objectID: string; title: string | null; url: string | null; points: number | null; num_comments: number | null; created_at: string }

/** Pure. The phrases worth searching: the role's skill phrases first (they are specific), never one-word job-title fragments. */
export function newsQueries(ctx: Pick<CareerContext, "keywords">, limit = PHRASES): string[] {
  const skills = ctx.keywords.filter((k) => k.weight < 1 && k.term.length >= 4);
  const roleWords = ctx.keywords.filter((k) => k.weight >= 1 && k.term.length >= 4);
  return [...skills, ...roleWords].slice(0, limit).map((k) => k.term);
}

/** Pure. Merge hits from several searches: drop link-less and low-signal stories and duplicates, most discussed first. */
export function mergeHits(hits: Hit[], limit = NEWS_COUNT): NewsItem[] {
  const seen = new Set<string>();
  return hits
    .filter((h) => h.title && h.url && /^https?:\/\//.test(h.url) && (h.points ?? 0) >= MIN_POINTS)
    .sort((a, b) => (b.points ?? 0) + 2 * (b.num_comments ?? 0) - ((a.points ?? 0) + 2 * (a.num_comments ?? 0)))
    .filter((h) => (seen.has(h.objectID) || seen.has(h.url as string) ? false : (seen.add(h.objectID), seen.add(h.url as string), true)))
    .slice(0, limit)
    .map((h) => ({ id: h.objectID, title: h.title as string, url: h.url as string, source: hostOf(h.url as string), points: h.points ?? 0, comments: h.num_comments ?? 0, at: h.created_at }));
}

export const hostOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

export async function loadCareerNews(ctx: Pick<CareerContext, "keywords">, now = Date.now()): Promise<NewsItem[]> {
  const queries = newsQueries(ctx);
  if (queries.length === 0) return [];
  const since = Math.floor((now - DAYS * 86_400_000) / 1000);
  const results = await Promise.all(queries.map(async (q): Promise<Hit[]> => {
    const url = `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=${PER_QUERY}&query=${encodeURIComponent(q)}&numericFilters=${encodeURIComponent(`created_at_i>${since},points>${MIN_POINTS}`)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: CACHE_SECONDS } });
      return res.ok ? (((await res.json()) as { hits?: Hit[] }).hits ?? []) : [];
    } catch {
      return []; // news is a nicety: a slow or failing source must never break the page
    }
  }));
  return mergeHits(results.flat());
}
