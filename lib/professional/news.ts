import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { MIN_POINTS, mergeHits, newsQueries, type Hit, type NewsItem } from "./news-rules";

export type { NewsItem } from "./news-rules";

const TIMEOUT_MS = 4000;

async function search(query: string): Promise<Hit[]> {
  const since = Math.floor(Date.now() / 1000) - 14 * 86_400;
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=${encodeURIComponent(`created_at_i>${since},points>=${MIN_POINTS}`)}&hitsPerPage=8`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as { hits?: Hit[] }).hits ?? [];
}

/**
 * Technical news for a professional's own skills, from the free Hacker News search. The source is called at most once a day per set of skills;
 * the result is kept in the shared news cache. Never throws: no news is better than a broken page.
 */
export async function professionalNews(skillNames: readonly string[]): Promise<NewsItem[]> {
  const queries = newsQueries(skillNames);
  if (queries.length === 0) return [];
  const key = `pro:${queries.join("|")}`;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const db = untyped(createServiceClient());
    const { data } = await db.from("pulse_news_cache").select("items").eq("cache_key", key).eq("day", day).maybeSingle();
    const cached = (data as { items?: NewsItem[] } | null)?.items;
    if (Array.isArray(cached)) return cached;
    const hits = (await Promise.all(queries.map((q) => search(q).catch(() => [] as Hit[])))).flat();
    const items = mergeHits(hits);
    await db.from("pulse_news_cache").upsert({ cache_key: key, day, items, fetched_at: new Date().toISOString() }, { onConflict: "cache_key,day" });
    return items;
  } catch (e) {
    console.error("[professional/news]", (e as Error).message);
    return [];
  }
}
