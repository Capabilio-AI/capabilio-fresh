import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ELO_TIERS, getTier } from "@/lib/portfolio/elo";
import { loadElos, type RosterRow } from "./roster";

type Elo = NonNullable<RosterRow["elo"]>;

export interface TierSlice { label: string; color: string; count: number; /** drawn as a hatched stripe so "not rated" never reads as another tier */ hatched?: boolean }
export interface TopStudent { userId: string; name: string; avatarUrl: string | null; rating: number; tier: string; career: string | null }
export interface CohortInsights {
  /** one slice per ELO tier, plus "Not rated yet"; counts add up to `total` */
  distribution: TierSlice[];
  total: number;
  rated: number;
  top: TopStudent[];
  /** true when the cohort is larger than the sample cap, so the figures describe the first CAP students */
  capped: boolean;
}

const CAP = 3000; // ponytail: a sample ceiling keeps one page load to ~20 light queries; raise it, or move this to a SQL view, for larger colleges
const CHUNK = 150; // ids per query: keeps the URL short and stays under the 1000-row response limit
const TOP = 5;
const NOT_RATED: Omit<TierSlice, "count"> = { label: "Not rated yet", color: "#a8a29e", hatched: true };

/** Pure. Tier counts for a cohort of `total` students of whom `ratings` are rated. */
export function tierDistribution(ratings: number[], total: number): TierSlice[] {
  const tiers = ELO_TIERS.map((t) => ({ label: t.label, color: t.color, count: ratings.filter((r) => getTier(r).label === t.label).length }));
  return [...tiers, { ...NOT_RATED, count: Math.max(0, total - ratings.length) }];
}

/** Pure. The highest-rated students first; ties keep a stable order by id. */
export function topRated(elos: Map<string, Elo>, n: number): [string, Elo][] {
  return [...elos.entries()].sort((a, b) => b[1].rating - a[1].rating || a[0].localeCompare(b[0])).slice(0, n);
}

/** A whole-cohort picture (ELO spread and best-rated students) for the students page, built from ids only. */
export async function loadCohortInsights(service: SupabaseClient<Database>, ids: string[]): Promise<CohortInsights> {
  const sample = ids.slice(0, CAP);
  const chunks: string[][] = [];
  for (let i = 0; i < sample.length; i += CHUNK) chunks.push(sample.slice(i, i + CHUNK));
  const elos = new Map<string, Elo>();
  for (const m of await Promise.all(chunks.map((c) => loadElos(service, c)))) for (const [k, v] of m) elos.set(k, v);

  const best = topRated(elos, TOP);
  const { data: people } = best.length ? await service.from("profiles").select("id, full_name, email, avatar_url").in("id", best.map(([id]) => id)) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return {
    distribution: tierDistribution([...elos.values()].map((e) => e.rating), sample.length),
    total: sample.length,
    rated: elos.size,
    capped: ids.length > CAP,
    top: best.map(([userId, e]) => ({ userId, name: byId.get(userId)?.full_name ?? byId.get(userId)?.email ?? "Student", avatarUrl: byId.get(userId)?.avatar_url ?? null, rating: e.rating, tier: e.tier, career: e.career })),
  };
}
