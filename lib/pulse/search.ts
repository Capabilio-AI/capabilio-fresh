import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds } from "./graph";
import { escapeLike } from "./format";
import { loadPeople, type PersonSummary } from "./people";

type Service = SupabaseClient<Database>;

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;

export interface PersonHit extends PersonSummary {
  following: boolean;
}
export interface CollegeHit {
  id: string;
  name: string;
  slug: string;
  location: string | null;
}
export interface SearchResults {
  people: PersonHit[];
  colleges: CollegeHit[];
}

export const cleanQuery = (raw: string): string => raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY);

/**
 * People (discoverable profiles whose name matches) and colleges (public college pages) for the global search bar. Never exposes an email;
 * blocked people in either direction are left out; someone who turned discovery off appears only to the people who already follow them.
 */
export async function searchPulse(service: Service, viewerId: string, rawQuery: string, limits = { people: 6, colleges: 4 }): Promise<SearchResults> {
  const q = cleanQuery(rawQuery);
  if (q.length < MIN_QUERY) return { people: [], colleges: [] };
  const like = `%${escapeLike(q.toLowerCase())}%`;
  const db = untyped(service);

  const [{ data: byName }, { data: institutions }, blocked, following] = await Promise.all([
    db.from("profiles").select("id, pulse_discoverable").ilike("full_name", like).neq("id", viewerId).limit(limits.people * 4),
    service.from("institutions").select("id, name, slug, city, state").ilike("name", like).limit(limits.colleges * 3),
    blockedWith(service, viewerId),
    followingIds(service, viewerId),
  ]);
  const followed = new Set(following);
  const ids = ((byName ?? []) as { id: string; pulse_discoverable: boolean }[])
    .filter((p) => !blocked.has(p.id) && (p.pulse_discoverable || followed.has(p.id)))
    .slice(0, limits.people)
    .map((p) => p.id);
  const people = await loadPeople(service, ids);

  const instIds = (institutions ?? []).map((i) => i.id);
  const [{ data: publicPages }, { data: myMemberships }] = instIds.length
    ? await Promise.all([
        db.from("org_profiles").select("institution_id").in("institution_id", instIds).eq("is_public", true),
        service.from("institution_memberships").select("institution_id").eq("user_id", viewerId).eq("status", "active").in("institution_id", instIds),
      ])
    : [{ data: [] }, { data: [] }];
  const visible = new Set([...((publicPages ?? []) as { institution_id: string }[]).map((p) => p.institution_id), ...((myMemberships ?? []) as { institution_id: string }[]).map((m) => m.institution_id)]);

  return {
    people: ids.flatMap((id) => (people.has(id) ? [{ ...(people.get(id) as PersonSummary), following: followed.has(id) }] : [])),
    colleges: (institutions ?? [])
      .filter((i) => visible.has(i.id))
      .slice(0, limits.colleges)
      .map((i) => ({ id: i.id, name: i.name, slug: i.slug, location: [i.city, i.state].filter(Boolean).join(", ") || null })),
  };
}
