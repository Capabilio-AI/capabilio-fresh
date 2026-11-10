import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { fetchPostings, marketKeys } from "./adzuna";
import { buildSnapshot, type MarketSnapshot, type SkillVocab } from "./snapshot";

type Service = SupabaseClient<Database>;

/** Market numbers older than this are fetched again. Jobs move slowly enough that more often would only spend the quota. */
export const MARKET_FRESH_DAYS = 14;

export async function loadSnapshot(service: Service, careerId: string): Promise<MarketSnapshot | null> {
  const { data } = await untyped(service).from("career_market_snapshots").select("data").eq("career_id", careerId).maybeSingle();
  return ((data as { data: MarketSnapshot } | null)?.data) ?? null;
}

/** Every active skill with the words that count as a mention: its name and its aliases. */
export async function loadVocab(service: Service): Promise<SkillVocab[]> {
  const [{ data: skills }, { data: aliases }] = await Promise.all([
    service.from("skills").select("id, name").eq("status", "active"),
    untyped(service).from("skill_aliases").select("skill_id, alias"),
  ]);
  const by = new Map<string, string[]>();
  for (const a of (aliases ?? []) as { skill_id: string; alias: string }[]) by.set(a.skill_id, [...(by.get(a.skill_id) ?? []), a.alias]);
  return (skills ?? []).map((s) => ({ id: s.id, name: s.name, patterns: [s.name, ...(by.get(s.id) ?? [])] }));
}

export const isFresh = (s: MarketSnapshot | null, now: number = Date.now()): boolean => Boolean(s) && now - Date.parse(s!.fetchedAt) < MARKET_FRESH_DAYS * 86_400_000;

/**
 * The role's market snapshot: the stored one while it is fresh, otherwise a new one from live postings. Returns null (never throws) when no
 * job-data key is set, the service is down, or too few postings came back to say anything, so callers simply carry on without market data.
 */
export async function refreshMarket(service: Service, career: { id: string; name: string }, opts: { force?: boolean; fetchImpl?: typeof fetch } = {}): Promise<MarketSnapshot | null> {
  const stored = await loadSnapshot(service, career.id);
  if (!opts.force && isFresh(stored)) return stored;
  const keys = marketKeys();
  if (!keys) return stored;
  try {
    const postings = await fetchPostings(career.name, keys, { fetchImpl: opts.fetchImpl });
    if (postings.length < 10) return stored;
    const snapshot = buildSnapshot(career.name, postings, await loadVocab(service));
    const { error } = await untyped(service).from("career_market_snapshots").upsert({ career_id: career.id, data: snapshot, sampled: snapshot.sampled, fetched_at: snapshot.fetchedAt }, { onConflict: "career_id" });
    if (error) throw error;
    return snapshot;
  } catch (e) {
    console.error("[market] could not refresh", career.name, e instanceof Error ? e.message : e);
    return stored;
  }
}
