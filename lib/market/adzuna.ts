import { parsePostings, type Posting } from "./snapshot";

const COUNTRY = "in";
const PER_PAGE = 50;
const DEFAULT_PAGES = 3;

export interface MarketKeys { appId: string; appKey: string }
/** The job-data keys, or null when none are set (the market layer then does nothing and roadmaps fall back to the AI's own knowledge). */
export function marketKeys(env: Record<string, string | undefined> = process.env): MarketKeys | null {
  const appId = env.ADZUNA_APP_ID?.trim();
  const appKey = env.ADZUNA_APP_KEY?.trim();
  return appId && appKey ? { appId, appKey } : null;
}

/** Live Indian postings for a role, newest page first, de-duplicated. Throws with a message that never contains the keys. */
export async function fetchPostings(role: string, keys: MarketKeys, opts: { pages?: number; fetchImpl?: typeof fetch } = {}): Promise<Posting[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const seen = new Map<string, Posting>();
  for (let page = 1; page <= (opts.pages ?? DEFAULT_PAGES); page++) {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/${page}`);
    url.search = new URLSearchParams({ app_id: keys.appId, app_key: keys.appKey, what: role, results_per_page: String(PER_PAGE), "content-type": "application/json" }).toString();
    const res = await doFetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`The job-data service answered ${res.status}.`);
    const posts = parsePostings(await res.json().catch(() => null));
    for (const p of posts) seen.set(p.id, p);
    if (posts.length < PER_PAGE) break; // the last page
  }
  return [...seen.values()];
}
