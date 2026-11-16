export interface NewsItem { id: string; title: string; url: string; source: string; points: number; comments: number }

export interface Hit { objectID: string; title: string | null; url: string | null; points: number | null; num_comments: number | null }

export const MIN_POINTS = 30;

export const NEWS_COUNT = 5;

export const hostOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

/** The phrases worth searching: the person's own skills, long enough to be specific, at most three. */
export function newsQueries(skillNames: readonly string[], limit = 3): string[] {
  return [...new Set(skillNames.map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 3))].slice(0, limit);
}

/** Merge hits from several searches: drop link-less, low-signal and repeated stories; the most discussed first. */
export function mergeHits(hits: readonly Hit[], limit = NEWS_COUNT): NewsItem[] {
  const seen = new Set<string>();
  return hits
    .filter((h) => h.title && h.url && /^https?:\/\//.test(h.url) && (h.points ?? 0) >= MIN_POINTS)
    .sort((a, b) => (b.points ?? 0) + 2 * (b.num_comments ?? 0) - ((a.points ?? 0) + 2 * (a.num_comments ?? 0)))
    .filter((h) => (seen.has(h.objectID) || seen.has(h.url as string) ? false : (seen.add(h.objectID), seen.add(h.url as string), true)))
    .slice(0, limit)
    .map((h) => ({ id: h.objectID, title: h.title as string, url: h.url as string, source: hostOf(h.url as string), points: h.points ?? 0, comments: h.num_comments ?? 0 }));
}

